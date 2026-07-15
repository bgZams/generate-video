require('dotenv').config();

const express = require('express');

// Centralized Error Reporting - Placeholder for external integration
function reportError(error, context = {}) {
    const timestamp = new Date().toISOString();
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack available';

    // Log to console (already handled by overridden console.error)
    console.error(`[Centralized Error] ${errorMessage}`, { context, timestamp, stack: errorStack });

    // TODO: Integrate with external error tracking services like Sentry, Bugsnag, etc.
    // Example:
    // if (process.env.SENTRY_DSN) {
    //     Sentry.captureException(error, { extra: { context, timestamp } });
    // }
}

const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generateVideo } = require('./services/videoGenerator');
const {
    DEFAULT_MODEL,
    VIDEO_MODE_PRESETS,
    generateIdeas,
    generateIdeasFor,
    getTitleHistory,
    saveUsedTitle
} = require('./services/narration_service');
const {
    generateNarrationAudio,
    saveAudioFile,
    getVoiceOptions,
    getSpeedOptions
} = require('./services/ttsService');
const {
    generateSubtitles,
    generateJSON
} = require('./services/subtitleService');
const {
    generateYouTubeMetadata
} = require('./services/metadataService');
const {
    getMusicByMood,
    analyzeMoodFromText,
    getFreeMusicServices,
    getMusicHistory,
    clearMusicHistory,
    extractTopicFromTitle,
    getLocalMusicList
} = require('./services/bgmService'); // Note: path might be ./services/bgmService if file is in services/

const youtubeService = require('./services/youtubeService');
const facebookService = require('./services/facebookService');
const tiktokService = require('./services/tiktokService');
const automationService = require('./services/automationService');
const schedulerService = require('./services/schedulerService');
const { generateThumbnail } = require('./services/thumbnailService');

const app = express();
const port = process.env.PORT || 3000;

// Global Log Buffer
let serverLogs = [];
const originalLog = console.log;
const originalError = console.error;

function addServerLog(type, ...args) {
    const timestamp = new Date().toLocaleTimeString();
    const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : arg).join(' ');
    serverLogs.push({ timestamp, type, message });
    if (serverLogs.length > 500) serverLogs.shift();
    if (type === 'error') originalError(`[${timestamp}]`, ...args);
    else originalLog(`[${timestamp}]`, ...args);
}

console.log = (...args) => addServerLog('info', ...args);
console.error = (...args) => addServerLog('error', ...args);
console.warn = (...args) => addServerLog('warn', ...args);

// Setup Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend
app.use('/output', express.static('output')); // Serve generated videos

// Ensure directories exist
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};
ensureDir('./uploads');
ensureDir('./temp');
ensureDir('./output');
ensureDir('./data');

// ===== JOB PROGRESS TRACKING (SSE) =====
// Map<jobId, { clients: Set<res>, phases: Object }>
const jobProgressMap = new Map();

function emitJobProgress(jobId, phase, pct, message) {
    const job = jobProgressMap.get(jobId);
    if (!job) return;
    const payload = JSON.stringify({ phase, pct, message, ts: Date.now() });
    job.clients.forEach(res => {
        try { res.write(`data: ${payload}\n\n`); } catch (_) {}
    });
    // Keep last state for late-connecting clients
    job.lastState = { phase, pct, message };
}

function cleanupJob(jobId) {
    const job = jobProgressMap.get(jobId);
    if (job) {
        job.clients.forEach(res => { try { res.end(); } catch (_) {} });
        jobProgressMap.delete(jobId);
    }
}

// Expose emitter so videoGenerator can call it
global.emitJobProgress = emitJobProgress;

// Multer setup for handling file uploads (images/audio)
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads');
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// ===== VIDEO MODE PRESETS ENDPOINT =====
app.get('/api/video-mode-presets', (req, res) => {
    res.json({ success: true, presets: VIDEO_MODE_PRESETS });
});

// ===== JOB PROGRESS SSE ENDPOINT =====
app.get('/api/job/:jobId/progress', (req, res) => {
    const { jobId } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    if (!jobProgressMap.has(jobId)) {
        jobProgressMap.set(jobId, { clients: new Set(), lastState: null });
    }
    const job = jobProgressMap.get(jobId);
    job.clients.add(res);

    // Send last known state immediately for reconnects
    if (job.lastState) {
        res.write(`data: ${JSON.stringify(job.lastState)}\n\n`);
    }

    req.on('close', () => {
        job.clients.delete(res);
    });
});

app.get('/api/narration/history', (req, res) => {
    try {
        res.json({
            success: true,
            items: getTitleHistory()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/narration/generate', async (req, res) => {
    try {
        const {
            topic,
            slideCount,
            count,
            model,
            provider,
            apiKey,
            videoMode
        } = req.body || {};

        if (!topic || !topic.trim()) {
            return res.status(400).json({ success: false, error: 'Topic is required' });
        }

        const chosenProvider = (provider || 'gemini').toLowerCase();
        const envFallback = {
            gemini: process.env.GEMINI_API_KEY,
            openai: process.env.OPENAI_API_KEY,
            claude: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY
        }[chosenProvider];
        const keyToUse = (apiKey && apiKey.trim()) || envFallback;

        const result = await generateIdeasFor(chosenProvider, keyToUse, {
            topic,
            slideCount,
            count,
            model: model || DEFAULT_MODEL,
            videoMode: videoMode || 'short'
        });

        res.json({
            success: true,
            ...result,
            history: getTitleHistory()
        });
    } catch (error) {
        const status = /API key/i.test(error.message) ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ===== TEXT-TO-SPEECH ENDPOINTS =====

// Get available voice options
app.get('/api/tts/voices', (req, res) => {
    try {
        res.json({
            success: true,
            voices: getVoiceOptions()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get available speed options
app.get('/api/tts/speeds', (req, res) => {
    try {
        res.json({
            success: true,
            speeds: getSpeedOptions()
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Generate narration audio
app.post('/api/tts/generate', async (req, res) => {
    try {
        const { text, voice = 'shimmer', speed = 1.0 } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Narasi text diperlukan' });
        }

        const audioBuffer = await generateNarrationAudio(
            text,
            voice,
            speed,
            process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
        );

        // Set response headers untuk audio MP3
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Content-Disposition', 'attachment; filename="narration.mp3"');
        
        res.send(audioBuffer);
    } catch (error) {
        const status = /API key/i.test(error.message) ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

// Generate and save narration audio
app.post('/api/tts/generate-and-save', async (req, res) => {
    try {
        const { text, voice = 'shimmer', speed = 1.0, filename } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Narasi text diperlukan' });
        }

        if (!filename) {
            return res.status(400).json({ error: 'Nama filename diperlukan' });
        }

        const audioBuffer = await generateNarrationAudio(
            text,
            voice,
            speed,
            process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
        );

        const filepath = await saveAudioFile(audioBuffer, filename);

        res.json({
            success: true,
            filepath: filepath,
            url: `/output/${path.basename(filepath)}`
        });
    } catch (error) {
        const status = /API key/i.test(error.message) ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

// ===== SUBTITLE GENERATION ENDPOINTS =====

// Generate subtitles from narration text
app.post('/api/subtitles/generate', (req, res) => {
    try {
        const { text, duration, filename = 'subtitles' } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Narasi text diperlukan' });
        }

        const result = generateSubtitles(
            text,
            duration ? parseFloat(duration) : null,
            path.join(__dirname, 'output'),
            filename
        );

        res.json({
            success: true,
            srtPath: result.srtPath,
            vttPath: result.vttPath,
            srtUrl: `/output/${path.basename(result.srtPath)}`,
            vttUrl: `/output/${path.basename(result.vttPath)}`,
            subtitles: result.subtitles,
            count: result.count,
            json: generateJSON(result.subtitles)
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Get subtitle as file
app.get('/api/subtitles/download/:format/:filename', (req, res) => {
    try {
        const { format, filename } = req.params;
        const allowedFormats = ['srt', 'vtt'];

        if (!allowedFormats.includes(format)) {
            return res.status(400).json({ error: 'Format tidak valid (srt atau vtt)' });
        }

        const filepath = path.join(__dirname, 'output', `${filename}.${format}`);

        if (!fs.existsSync(filepath)) {
            return res.status(404).json({ error: 'File tidak ditemukan' });
        }

        res.setHeader('Content-Type', format === 'srt' ? 'text/plain' : 'text/vtt');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.${format}"`);
        res.sendFile(filepath);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// ===== YOUTUBE METADATA ENDPOINTS =====

// Generate YouTube metadata (titles, description, hashtags, tags)
app.post('/api/metadata/youtube', async (req, res) => {
    try {
        const {
            title,
            topic,
            summary,
            narrationPoints = [],
            keywords = []
        } = req.body;

        if (!title || !topic) {
            return res.status(400).json({ error: 'Title dan topic diperlukan' });
        }

        const metadata = await generateYouTubeMetadata({
            title,
            topic,
            summary: summary || topic,
            narrationPoints,
            keywords,
            apiKey: process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY
        });

        res.json({
            success: true,
            metadata
        });
    } catch (error) {
        const status = /API key/i.test(error.message) ? 400 : 500;
        res.status(status).json({ error: error.message });
    }
});

// API Endpoint for Form Data with Files
app.post('/api/generate', upload.any(), async (req, res) => {
    try {
        const payloadStr = req.body.payload;
        if (!payloadStr) {
            return res.status(400).json({ error: 'Payload configuration missing' });
        }

        const config = JSON.parse(payloadStr);
        // config expected structure:
        // {
        //   resolution: "9:16" | "16:9",
        //   bgmUrl: "...",
        //   slides: [ { text: "Hello", imageUrl: "...", fileField: "slide_0_img" } ]
        // }

        // Map uploaded files to config
        const files = req.files || [];
        config.slides.forEach((slide, index) => {
            const slideFile = files.find(f => f.fieldname === `slide_img_${index}`);
            if (slideFile) {
                slide.localImagePath = slideFile.path;
            }
        });

        const bgmFile = files.find(f => f.fieldname === 'bgm_audio');
        if (bgmFile) {
            config.localBgmPath = bgmFile.path;
        } else if (config.bgmMood) {
            // Auto-select music if mood is specified
            try {
                console.log(`  Auto-selecting BGM with mood: ${config.bgmMood}`);
                const musicInfo = await getMusicByMood(
                    config.bgmMood,
                    config.storyTitle || null,
                    path.join(__dirname, 'output')
                );
                if (musicInfo.path) {
                    config.localBgmPath = musicInfo.path;
                    console.log(`  ✅ Auto-selected: ${musicInfo.title || 'Pexels Music'}`);
                } else {
                    console.log(`  ⚠️ Auto-selection failed: ${musicInfo.error || 'unknown error'}`);
                }
            } catch (err) {
                console.error(`  ❌ Auto-music error: ${err.message}`);
            }
        }

        // Apply pro-feature defaults unless explicitly turned off by the UI
        if (config.captions === undefined)    config.captions = true;
        if (config.transitions === undefined) config.transitions = true;
        if (config.progressBar === undefined) config.progressBar = true;

        // Channel-name watermark: auto-fetch from the connected YouTube channel
        // so every render carries the creator's handle. This protects against
        // re-uploads and helps the video pass YPP "original content" review.
        if (!config.channelName && youtubeService.isAuthenticated()) {
            try {
                const profile = await youtubeService.getChannelProfile();
                if (profile && profile.title) config.channelName = profile.title;
            } catch (_) { /* non-fatal */ }
        }

        // Generate Video
        const jobId = uuidv4();
        req._jobId = jobId; // simpan untuk error handler
        const outputPath = path.join('./output', `video_${jobId}.mp4`);

        // Setup progress tracking for SSE
        jobProgressMap.set(jobId, { clients: new Set(), lastState: null });
        // Send jobId immediately so frontend can subscribe to SSE progress
        res.setHeader('X-Job-Id', jobId);

        emitJobProgress(jobId, 'starting', 2, 'Memulai proses render...');
        emitJobProgress(jobId, 'image', 10, 'Mempersiapkan gambar...');
        emitJobProgress(jobId, 'render', 20, 'Rendering video... (ini mungkin memakan waktu)');
        await generateVideo(config, outputPath, jobId);
        emitJobProgress(jobId, 'render', 85, 'Rendering video selesai.');
        emitJobProgress(jobId, 'thumbnail', 88, 'Membuat thumbnail...');

        // Auto-thumbnail (portrait for 9:16, landscape otherwise)
        let thumbnailUrl = null;
        if (config.generateThumbnail !== false) {
            try {
                const orientation = (config.resolution === '9:16') ? 'portrait' : 'landscape';
                const thumbPath = path.join('./output', `thumb_${jobId}.png`);
                await generateThumbnail({
                    videoPath: outputPath,
                    outputPath: thumbPath,
                    title: config.storyTitle || 'YouTube Shorts',
                    orientation,
                    grabTime: 0.25
                });
                thumbnailUrl = `/output/thumb_${jobId}.png`;
            } catch (e) {
                console.warn(`Thumbnail generation failed: ${e.message}`);
            }
        }

        let usedTitle = null;
        if (config.storyTitle) {
            usedTitle = saveUsedTitle(config.storyTitle, {
                ideaId: config.storyIdeaId || '',
                narrationSegments: Array.isArray(config.slides)
                    ? config.slides.map(slide => slide.text || '').filter(Boolean)
                    : []
            });
        }

        emitJobProgress(jobId, 'done', 100, 'Video selesai! ✅');
        // Clean up SSE connections after a short delay
        setTimeout(() => cleanupJob(jobId), 5000);

        res.json({
            success: true,
            jobId,
            videoUrl: `/output/video_${jobId}.mp4`,
            thumbnailUrl,
            usedTitle
        });

    } catch (error) {
        console.error("Error generating video:", error);
        // Kirim error ke SSE agar UI tahu ada masalah
        if (error && typeof emitJobProgress === 'function') {
            try { emitJobProgress(req._jobId, 'error', 100, `❌ Gagal: ${error.message}`); } catch(_) {}
        }
        res.status(500).json({ error: error.message });
    }
});

// ===== BACKGROUND MUSIC (BGM) ENDPOINTS - ENHANCED =====

// Get free music services information
app.get('/api/bgm/services', (req, res) => {
    try {
        const services = getFreeMusicServices();
        res.json({
            success: true,
            services,
            note: 'Pexels requires API key setup for auto-download'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get music by mood (auto-download from Pexels) - ENHANCED
// Now supports title parameter for topic-specific music selection
app.post('/api/bgm/get-by-mood', async (req, res) => {
    try {
        const { mood = 'upbeat', title = null } = req.body;

        console.log(`🎵 Music Request: mood="${mood}"${title ? `, title="${title}"` : ''}`);

        const musicInfo = await getMusicByMood(
            mood,
            title,  // NEW: Pass title for topic detection
            path.join(__dirname, 'output')
        );

        res.json({
            success: true,
            music: musicInfo,
            note: musicInfo.source === 'error' ? 'Failed to get music, please check API key' : 'Music selected based on mood and topic'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Analyze video mood from narration text
app.post('/api/bgm/analyze-mood', (req, res) => {
    try {
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ error: 'Narasi text diperlukan' });
        }

        const mood = analyzeMoodFromText(text);

        res.json({
            success: true,
            mood,
            note: 'Use this mood to select appropriate background music'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// NEW: Analyze title to extract topic for music selection
app.post('/api/bgm/analyze-title', (req, res) => {
    try {
        const { title } = req.body;

        if (!title || !title.trim()) {
            return res.status(400).json({ error: 'Title diperlukan' });
        }

        const topic = extractTopicFromTitle(title);

        res.json({
            success: true,
            topic: topic?.topic || null,
            keywords: topic?.keywords || null,
            note: topic ? 'Topic detected - use for better music selection' : 'No specific topic detected, will use generic mood-based music'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// NEW: Get music history (tracking)
app.get('/api/bgm/history', (req, res) => {
    try {
        const history = getMusicHistory();

        res.json({
            success: true,
            history,
            note: 'Tracks recently used music to avoid repeats'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NEW: Clear music history
app.post('/api/bgm/clear-history', (req, res) => {
    try {
        clearMusicHistory();

        res.json({
            success: true,
            message: 'Music download history cleared - music can repeat now'
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// NEW: Get list of local music files
app.get('/api/bgm/local-list', (req, res) => {
    try {
        const musicList = getLocalMusicList();
        res.json({
            success: true,
            music: musicList
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== THUMBNAIL ENDPOINT =====

// Generate a thumbnail from an existing video file in /output
app.post('/api/thumbnail/generate', async (req, res) => {
    try {
        const { videoFile, title, orientation = 'portrait', grabTime = 0.8 } = req.body || {};
        if (!videoFile || !title) {
            return res.status(400).json({ error: 'videoFile dan title wajib diisi' });
        }

        // videoFile should be a bare filename inside /output to prevent path traversal
        const safeName = path.basename(videoFile);
        const videoPath = path.join(__dirname, 'output', safeName);
        if (!fs.existsSync(videoPath)) {
            return res.status(404).json({ error: 'Video tidak ditemukan' });
        }

        const thumbName = `thumb_${path.parse(safeName).name}.png`;
        const thumbPath = path.join(__dirname, 'output', thumbName);
        await generateThumbnail({ videoPath, outputPath: thumbPath, title, orientation, grabTime });

        res.json({ success: true, thumbnailUrl: `/output/${thumbName}`, path: thumbPath });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== AUTOMATION & SCHEDULER ENDPOINTS =====

// Get scheduler status and config
app.get('/api/scheduler/status', async (req, res) => {
    try {
        const isAuth = youtubeService.isAuthenticated();
        const isFbAuth = facebookService.isAuthenticated();
        const isTtAuth = tiktokService.isAuthenticated();

        const [youtubeProfile, facebookProfile, tiktokProfile] = await Promise.all([
            isAuth ? youtubeService.getChannelProfile().catch(() => null) : null,
            isFbAuth ? facebookService.getPageProfile().catch(() => null) : null,
            isTtAuth ? tiktokService.getUserProfile().catch(() => null) : null
        ]);

        res.json({
            success: true,
            status: schedulerService.getStatus(),
            isYouTubeAuthenticated: isAuth,
            youtubeProfile,
            isFacebookAuthenticated: isFbAuth,
            facebookProfile,
            isTiktokAuthenticated: isTtAuth,
            tiktokProfile
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Update scheduler config
app.post('/api/scheduler/update', (req, res) => {
    try {
        const config = req.body;
        const updated = schedulerService.update(config);
        res.json({
            success: true,
            config: updated
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// Manually trigger full automation workflow
app.post('/api/automation/run', async (req, res) => {
    try {
        const options = req.body || {};
        // Normalize AI provider/key/model fields (accept either naming scheme)
        options.provider = (options.provider || 'gemini').toLowerCase();
        options.aiApiKey = options.aiApiKey || options.apiKey || '';
        options.model = options.model || '';
        // Trigger async to not block
        automationService.runFullWorkflow(options)
            .then(result => console.log('Manual automation result:', result))
            .catch(err => console.error('Manual automation error:', err));

        res.json({
            success: true,
            message: 'Automation workflow started in background.'
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// NEW: Bulk automation runner
app.post('/api/automation/bulk-run', async (req, res) => {
    try {
        const { items, ...globalOptions } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'Items list is required' });
        }

        console.log(`📦 Bulk Automation: Received ${items.length} items to process.`);

        // We process them sequentially in background to avoid hitting API limits or OOM
        (async () => {
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                console.log(`\n📦 Processing Bulk Item ${i + 1}/${items.length}: "${item.title}"`);

                try {
                    // Merged options: global UI settings + item specific title/schedule
                    const runOptions = {
                        ...globalOptions,
                        topic: item.topic,
                        publishAt: item.publishAt,
                    };

                    await automationService.runFullWorkflow({
                        ...runOptions,
                        preDefinedIdea: {
                            title: item.title,
                            narrationSegments: item.narrationSegments,
                            id: item.ideaId
                        }
                    });

                    console.log(`✅ Bulk Item ${i + 1} completed.`);
                } catch (err) {
                    console.error(`❌ Bulk Item ${i + 1} failed:`, err.message);
                }

                // Add a safer delay between items for Gemini Free Tier (30 seconds)
                if (i < items.length - 1) {
                    console.log(`⏳ Waiting 30 seconds before next item to respect API quota...`);
                    await new Promise(r => setTimeout(r, 30000));
                }
            }
            console.log('\n📦 Bulk Automation: All items processed.');
        })();

        res.json({
            success: true,
            message: `Bulk processing for ${items.length} items started in background.`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ===== YOUTUBE AUTH ENDPOINTS =====

// Get YouTube Auth URL
app.get('/api/youtube/auth-url', (req, res) => {
    try {
        const url = youtubeService.getAuthUrl();
        res.json({ success: true, url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/youtube/disconnect', async (req, res) => {
    try {
        const success = await youtubeService.revokeTokens();
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Callback for YouTube Auth
app.get('/api/youtube/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).send('Code is required');

        await youtubeService.saveTokens(code);
        res.send('<h1>Authentication Successful!</h1><p>You can close this tab and return to the application.</p>');
    } catch (error) {
        res.status(500).send(`Authentication Failed: ${error.message}`);
    }
});

// ===== FACEBOOK AUTH ENDPOINTS =====
app.get('/api/facebook/auth-url', (req, res) => {
    try {
        const url = facebookService.getAuthUrl();
        res.json({ success: true, url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/facebook/disconnect', async (req, res) => {
    try {
        const success = await facebookService.revokeTokens();
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/facebook/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) return res.status(400).send('Code is required');
        await facebookService.saveTokens(code);
        res.send('<h1>Facebook Connected!</h1><p>You can close this tab.</p>');
    } catch (error) {
        res.status(500).send(`Facebook Auth Failed: ${error.response?.data?.error?.message || error.message}`);
    }
});

// ===== TIKTOK AUTH ENDPOINTS =====
app.get('/api/tiktok/auth-url', (req, res) => {
    try {
        const url = tiktokService.getAuthUrl();
        res.json({ success: true, url });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/tiktok/disconnect', async (req, res) => {
    try {
        const success = await tiktokService.revokeTokens();
        res.json({ success });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/tiktok/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (!code) return res.status(400).send('Code is required');
        await tiktokService.saveTokens(code, state);
        res.send('<h1>TikTok Connected!</h1><p>You can close this tab.</p>');
    } catch (error) {
        res.status(500).send(`TikTok Auth Failed: ${error.response?.data?.error_description || error.message}`);
    }
});

app.get('/api/logs', (req, res) => {
    res.json({ logs: serverLogs });
});

// MASTER COMMAND ENDPOINT (Bridge to Local Claude Agent)
app.post('/api/master/command', async (req, res) => {
    try {
        const { command, settings } = req.body;
        if (!command) return res.status(400).json({ success: false, error: 'Command is required' });

        const queuePath = path.join(__dirname, 'data/master_queue.json');
        let queue = [];
        if (fs.existsSync(queuePath)) {
            queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
        }

        const requestId = uuidv4();
        queue.push({
            id: requestId,
            command,
            settings,
            status: 'pending',
            timestamp: new Date().toISOString()
        });

        fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));

        res.json({
            success: true,
            requestId,
            message: `Perintah diterima. Menghubungkan ke Claude Agent di terminal lokal...`
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Endpoint untuk UI mengecek status respon dari Claude
app.get('/api/master/response/:id', (req, res) => {
    const queuePath = path.join(__dirname, 'data/master_queue.json');
    if (!fs.existsSync(queuePath)) return res.json({ status: 'waiting' });

    const queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    const item = queue.find(i => i.id === req.params.id);

    if (item && item.status === 'completed') {
        res.json({ status: 'completed', response: item.response, actionLogs: item.actionLogs });
    } else {
        res.json({ status: 'waiting' });
    }
});

// Initialize Scheduler
schedulerService.start();

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
