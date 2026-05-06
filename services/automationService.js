const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generateVideo } = require('./videoGenerator');
const { generateIdeas, generateIdeasFor, DEFAULT_MODEL, saveUsedTitle } = require('./narration_service');
const { generateNarrationAudio, saveAudioFile } = require('./ttsService');
const { generateYouTubeMetadata } = require('./metadataService');
const { getMusicByMood, analyzeMoodFromText } = require('./bgmService');
const youtubeService = require('./youtubeService');
const facebookService = require('./facebookService');
const tiktokService = require('./tiktokService');
const { generateThumbnail } = require('./thumbnailService');
const edgeTts = require('./edgeTtsService');

// --- Randomization helpers (anti "templated content" flag) ------------------
function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Variasi caption accent — rotasi gaya warna sub-judul burn-in
const CAPTION_ACCENTS = ['yellow', 'cyan', 'lime', '#FF5252', '#FFB300', '#7CFC00'];

// Variasi ukuran chunk caption (Submagic pakai 2; kita rotasi 2-3 utk variasi ritme)
const CAPTION_CHUNK_SIZES = [2, 2, 3, 3, 2]; // distribusi: lebih sering 2-3

/**
 * Bagi N slide ke grup acak — tiap grup share 1 gambar (hemat + natural).
 * Minimal 2 grup, maksimal 5 grup; ukuran tiap grup 1-5 slide.
 * Mengembalikan array `refMap` panjang N, berisi index slide awal grup
 * (atau null jika slide itu sendiri awal grup / tidak di-ref).
 */
function buildRandomGroups(slideCount) {
    const minGroups = 2;
    const maxGroups = Math.min(5, Math.max(minGroups, Math.ceil(slideCount / 2)));
    const groupCount = minGroups + Math.floor(Math.random() * (maxGroups - minGroups + 1));

    // Distribusi ukuran grup: shuffle + pastikan total == slideCount
    const sizes = new Array(groupCount).fill(1);
    let remaining = slideCount - groupCount;
    while (remaining > 0) {
        const idx = Math.floor(Math.random() * groupCount);
        if (sizes[idx] < 5) { sizes[idx]++; remaining--; }
    }

    const refMap = new Array(slideCount).fill(null);
    let cursor = 0;
    for (const size of sizes) {
        const head = cursor;
        for (let k = 1; k < size && head + k < slideCount; k++) {
            refMap[head + k] = head; // slide berikutnya re-use gambar slide awal grup
        }
        cursor += size;
    }
    return refMap;
}

/**
 * Automation Service - Manages the end-to-end workflow from idea to upload
 */
class AutomationService {
    constructor() {
        this.isProcessing = false;
        // Legacy: used only as a Gemini-flavored fallback for TTS/metadata
        // steps that currently assume Gemini. Idea generation now uses a
        // per-request provider/apiKey pair (see runFullWorkflow).
        this.apiKey = process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY;
    }

    _resolveAIConfig(options = {}) {
        const provider = (options.provider || 'gemini').toLowerCase();
        const envFallback = {
            gemini: process.env.GEMINI_API_KEY,
            openai: process.env.OPENAI_API_KEY,
            claude: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
        }[provider];
        const apiKey = (options.aiApiKey && options.aiApiKey.trim())
            || (options.apiKey && options.apiKey.trim())
            || envFallback
            || '';
        const defaultModels = {
            gemini: DEFAULT_MODEL,
            openai: 'gpt-4o-mini',
            claude: 'claude-sonnet-4-5'
        };
        const model = options.model || defaultModels[provider] || DEFAULT_MODEL;
        return { provider, apiKey, model };
    }

    /**
     * Run the full automated workflow
     * @param {Object} options 
     */
    async runFullWorkflow(options = {}) {
        if (this.isProcessing) {
            console.log('⚠️ Automation is already running. Skipping this cycle.');
            return { success: false, error: 'Already processing' };
        }

        const jobId = uuidv4();
        console.log(`\n🌟 Starting Full Automation Workflow (JobID: ${jobId})`);
        this.isProcessing = true;

        try {
            const {
                topic = 'Kata-kata Bijak dan Motivasi Kehidupan',
                slideCount = 15,
                // Default: rotasi otomatis antara 2 suara Edge TTS (pria/wanita)
                // supaya batch video tidak terdengar dari 1 voice yg sama.
                voice = edgeTts.pickRandomEdgeVoice(),
                privacyStatus = 'public',
                keywords = ['motivasi', 'katabijak', 'inspirasi', 'shorts', 'sukses'],
                publishAt = null, // ISO string for scheduling
                manualBgmPath = null, // Optional: use specific BGM instead of auto-selecting
                bgmMood = null, // Optional: force a specific mood
                visualEffect = 'none',
                vignette = false
            } = options;

            // Target 9 segments so the finished Short stays comfortably under
            // YouTube's 60s limit (≈5s narasi × 9 + padding ≈ 55-58s).
            const slideCountForIdea = 9;
            const ai = this._resolveAIConfig(options);
            if (!ai.apiKey) {
                throw new Error(`API key ${ai.provider.toUpperCase()} tidak tersedia. Masukkan token di UI atau .env.`);
            }
            console.log(`🤖 Using AI provider: ${ai.provider} (model: ${ai.model})`);
            const ideas = await generateIdeasFor(ai.provider, ai.apiKey, {
                topic,
                slideCount: slideCountForIdea,
                count: 1,
                model: ai.model
            });

            if (!ideas || !ideas.ideas || ideas.ideas.length === 0) {
                throw new Error('Failed to generate narration ideas');
            }

            const idea = ideas.ideas[0];
            const title = idea.title;
            const segments = idea.narrationSegments || [];
            const fullText = segments.join(' ');

            console.log(`   ✅ Topic: ${title} (11 Slides)`);

            // 2. Generate Audio (TTS) per segment — Edge TTS (gratis, natural)
            // Speed juga dirandom sedikit (0.95–1.05) supaya ritme narasi
            // tidak identik antar video.
            const speedJitter = +(0.95 + Math.random() * 0.1).toFixed(2);
            console.log(`🎙️ Step 2: Generating high-quality narration audio (voice=${voice}, speed=${speedJitter})...`);
            const segmentAudioPaths = [];
            for (let i = 0; i < Math.min(segments.length, slideCountForIdea); i++) {
                try {
                    const audioBuffer = await generateNarrationAudio(segments[i], voice, speedJitter, this.apiKey);
                    const audioFilename = `auto_audio_${jobId}_${i}`;
                    const audioPath = await saveAudioFile(audioBuffer, audioFilename);
                    segmentAudioPaths.push(audioPath);
                    console.log(`   ✅ Segment ${i+1}/${segments.length} audio ready`);
                } catch (err) {
                    console.error(`   ⚠️ Failed to generate audio for segment ${i+1}:`, err.message);
                    segmentAudioPaths.push(null); // Fallback to auto-TTS in generator if needed
                }
            }

            // 3. Analyze Mood & Get BGM (unless manual path provided)
            let localBgmPath = manualBgmPath;
            if (!localBgmPath) {
                console.log('🎵 Step 3: Getting BGM...');
                const selectedMood = bgmMood || analyzeMoodFromText(fullText);
                const musicInfo = await getMusicByMood(selectedMood, title, path.join(__dirname, '../output'));
                localBgmPath = musicInfo.path || null;
                console.log(`   ✅ Mood: ${selectedMood}, BGM: ${musicInfo.title || 'None'}`);
            } else {
                console.log(`🎵 Step 3: Using manual BGM path: ${localBgmPath}`);
            }

            // 4. Generate YouTube Metadata (uses the SAME provider as ideas)
            console.log(`📊 Step 4: Generating SEO metadata via ${ai.provider}...`);
            const metadata = await generateYouTubeMetadata({
                title,
                topic,
                summary: title,
                narrationPoints: segments,
                keywords,
                apiKey: ai.apiKey,
                provider: ai.provider,
                model: ai.model
            });
            console.log('   ✅ Metadata generated.');

            // 5. Prepare Video Config with RANDOMIZED grouping (anti templated-flag)
            console.log('🎬 Step 5: Rendering video with randomized image grouping...');
            const usableSegments = segments.slice(0, slideCountForIdea);
            const refMap = buildRandomGroups(usableSegments.length);

            // Randomize caption styling per video
            const captionAccent = options.captionAccent || pickRandom(CAPTION_ACCENTS);
            const captionChunkSize = options.captionChunkSize || pickRandom(CAPTION_CHUNK_SIZES);

            // Fetch channel name from the connected YouTube account so the
            // watermark marks every video as originating from the creator.
            let channelName = options.channelName || null;
            if (!channelName && youtubeService.isAuthenticated()) {
                try {
                    const profile = await youtubeService.getChannelProfile();
                    if (profile && profile.title) channelName = profile.title;
                } catch (_) { /* non-fatal */ }
            }

            const videoConfig = {
                storyTitle: title,
                resolution: '9:16',
                localBgmPath: localBgmPath,
                visualEffect: visualEffect,
                vignette: vignette,
                ttsVoice: voice, // diteruskan ke internal fallback generateTTS
                channelName,
                // Hard cap supaya video tetap valid Shorts (< 60s). Kalau narasi
                // AI kepanjangan, generator akan trim ke nilai ini di akhir.
                maxDurationSec: 58,
                // Pro pipeline feature toggles — all ON by default for Shorts
                captions: options.captions !== false,
                captionChunkSize,
                captionAccent,
                transitions: options.transitions !== false,
                progressBar: options.progressBar !== false,
                slides: usableSegments.map((text, idx) => {
                    const refSlide = refMap[idx];
                    const imageSource = refSlide != null ? 'ref' : 'auto';
                    return {
                        text,
                        imageSource,
                        refSlide,
                        audioPath: segmentAudioPaths[idx]
                    };
                })
            };
            console.log(`   🎨 Variations -> groups=${new Set(refMap.map((v,i)=>v??i)).size}, chunk=${captionChunkSize}, accent=${captionAccent}`);

            const outputPath = path.join(__dirname, '../output', `auto_video_${jobId}.mp4`);
            await generateVideo(videoConfig, outputPath, jobId);
            console.log(`   ✅ Video rendered: ${outputPath}`);

            // 5b. Auto-generate thumbnail (portrait for Shorts)
            console.log('🖼️ Step 5b: Generating thumbnail...');
            let thumbnailPath = null;
            try {
                thumbnailPath = path.join(__dirname, '../output', `auto_thumb_${jobId}.png`);
                await generateThumbnail({
                    videoPath: outputPath,
                    outputPath: thumbnailPath,
                    title: metadata.titles?.variations?.[0] || title,
                    orientation: 'portrait'
                    // grabTime & palette dibiarkan default = RANDOM
                    // supaya tiap thumbnail tampil beda (warna & frame-start).
                });
            } catch (thumbErr) {
                console.warn(`   ⚠️ Thumbnail generation failed: ${thumbErr.message}`);
                thumbnailPath = null;
            }

            // 6. Save to History
            saveUsedTitle(title, {
                ideaId: idea.id || '',
                narrationSegments: segments
            });

            const finalTitle = metadata.titles?.variations?.[0] || title;
            const platformTargets = options.platforms || {};
            const wantYouTube = platformTargets.youtube !== false;
            const wantFacebook = platformTargets.facebook !== false;
            const wantTiktok   = platformTargets.tiktok   !== false;

            // 7a. Upload to YouTube (if authenticated + enabled)
            let youtubeResult = null;
            if (wantYouTube && youtubeService.isAuthenticated()) {
                console.log('🚀 Step 6a: Uploading to YouTube...');
                try {
                    youtubeResult = await youtubeService.uploadVideo({
                        path: outputPath,
                        title: finalTitle,
                        description: metadata.description,
                        tags: metadata.tags,
                        privacyStatus: privacyStatus,
                        publishAt: publishAt,
                        thumbnailPath
                    });
                    console.log('   ✅ YouTube Upload Complete!');
                } catch (uploadError) {
                    console.error('   ❌ YouTube Upload Failed:', uploadError.message);
                    youtubeResult = {
                        success: false,
                        error: uploadError.message,
                        note: 'YouTube upload limit might be reached or connection issue.'
                    };
                }
            } else if (wantYouTube) {
                console.log('⚠️ Step 6a: Skipping YouTube upload (Not authenticated).');
            }

            // 7b. Upload to Facebook Page (Reels)
            let facebookResult = null;
            if (wantFacebook && facebookService.isAuthenticated()) {
                console.log('🚀 Step 6b: Uploading to Facebook Reels...');
                try {
                    facebookResult = await facebookService.uploadVideo({
                        path: outputPath,
                        title: finalTitle,
                        description: metadata.description,
                        asReel: true
                    });
                    console.log('   ✅ Facebook Upload Complete!');
                } catch (err) {
                    console.error('   ❌ Facebook Upload Failed:', err.response?.data || err.message);
                    facebookResult = { success: false, error: err.message };
                }
            } else if (wantFacebook) {
                console.log('⚠️ Step 6b: Skipping Facebook upload (Not authenticated).');
            }

            // 7c. Upload to TikTok (inbox/draft by default)
            let tiktokResult = null;
            if (wantTiktok && tiktokService.isAuthenticated()) {
                console.log('🚀 Step 6c: Uploading to TikTok...');
                try {
                    tiktokResult = await tiktokService.uploadVideo({
                        path: outputPath,
                        title: finalTitle,
                        description: metadata.description
                    });
                    console.log('   ✅ TikTok Upload Complete!');
                } catch (err) {
                    console.error('   ❌ TikTok Upload Failed:', err.response?.data || err.message);
                    tiktokResult = { success: false, error: err.message };
                }
            } else if (wantTiktok) {
                console.log('⚠️ Step 6c: Skipping TikTok upload (Not authenticated).');
            }

            console.log(`✨ Workflow Complete (JobID: ${jobId})\n`);

            return {
                success: true,
                jobId,
                title,
                videoPath: outputPath,
                thumbnailPath,
                youtube: youtubeResult,
                facebook: facebookResult,
                tiktok: tiktokResult,
                metadata
            };

        } catch (error) {
            console.error(`❌ Automation Workflow Failed (JobID: ${jobId}):`, error.message);
            return { success: false, error: error.message };
        } finally {
            this.isProcessing = false;
        }
    }
}

module.exports = new AutomationService();
