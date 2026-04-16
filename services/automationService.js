const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generateVideo } = require('./videoGenerator');
const { generateIdeas, generateIdeasFor, DEFAULT_MODEL, saveUsedTitle } = require('./narration_service');
const { generateNarrationAudio, saveAudioFile } = require('./ttsService');
const { generateYouTubeMetadata } = require('./metadataService');
const { getMusicByMood, analyzeMoodFromText } = require('./bgmService');
const youtubeService = require('./youtubeService');
const { generateThumbnail } = require('./thumbnailService');

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
                voice = 'google-id', // Native Indonesian accent (Google)
                privacyStatus = 'public',
                keywords = ['motivasi', 'katabijak', 'inspirasi', 'shorts', 'sukses'],
                publishAt = null, // ISO string for scheduling
                manualBgmPath = null, // Optional: use specific BGM instead of auto-selecting
                bgmMood = null, // Optional: force a specific mood
                visualEffect = 'none',
                vignette = false
            } = options;

            // Ensure we have exactly 11 segments
            const slideCountForIdea = 11;
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

            // 2. Generate Audio (TTS) per segment for high-quality consistent voice
            console.log('🎙️ Step 2: Generating high-quality narration audio per segment...');
            const segmentAudioPaths = [];
            for (let i = 0; i < Math.min(segments.length, 11); i++) {
                try {
                    const audioBuffer = await generateNarrationAudio(segments[i], voice, 1.0, this.apiKey);
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

            // 5. Prepare Video Config with Grouping Logic (Enforce 11 slides)
            console.log('🎬 Step 5: Rendering video with image grouping (11 slides)...');
            const videoConfig = {
                storyTitle: title,
                resolution: '9:16',
                localBgmPath: localBgmPath,
                visualEffect: visualEffect,
                vignette: vignette,
                // Pro pipeline feature toggles — all ON by default for Shorts
                captions: options.captions !== false,
                captionChunkSize: options.captionChunkSize || 2,
                captionAccent: options.captionAccent || 'yellow',
                transitions: options.transitions !== false,
                progressBar: options.progressBar !== false,
                slides: segments.slice(0, 11).map((text, idx) => {
                    let imageSource = 'auto';
                    let refSlide = null;

                    // Grouping Logic:
                    // Group 1: Slide 1-3 (idx 0-2) -> Slide 2 & 3 ref Slide 1
                    if (idx >= 1 && idx <= 2) {
                        imageSource = 'ref';
                        refSlide = 0;
                    }
                    // Group 2: Slide 4-8 (idx 3-7) -> Slide 5-8 ref Slide 4
                    else if (idx >= 4 && idx <= 7) {
                        imageSource = 'ref';
                        refSlide = 3;
                    }
                    // Group 3: Slide 9-11 (idx 8-10) -> Slide 10-11 ref Slide 9
                    else if (idx >= 9 && idx <= 10) {
                        imageSource = 'ref';
                        refSlide = 8;
                    }

                    return {
                        text,
                        imageSource,
                        refSlide,
                        audioPath: segmentAudioPaths[idx] // FIXED: Pass the generated high-quality audio
                    };
                })
            };

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
                    orientation: 'portrait',
                    grabTime: 0.25
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

            // 7. Upload to YouTube (if authenticated)
            let youtubeResult = null;
            if (youtubeService.isAuthenticated()) {
                console.log('🚀 Step 6: Uploading to YouTube...');
                try {
                    youtubeResult = await youtubeService.uploadVideo({
                        path: outputPath,
                        title: metadata.titles?.variations?.[0] || title,
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
            } else {
                console.log('⚠️ Step 6: Skipping YouTube upload (Not authenticated).');
            }

            console.log(`✨ Workflow Complete (JobID: ${jobId})\n`);

            return {
                success: true,
                jobId,
                title,
                videoPath: outputPath,
                thumbnailPath,
                youtube: youtubeResult,
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
