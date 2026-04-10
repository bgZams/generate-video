require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generateVideo } = require('./services/videoGenerator');
const {
    DEFAULT_MODEL,
    generateIdeas,
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
    extractTopicFromTitle
} = require('./services/bgmService');

const app = express();
const port = 3000;

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
            model
        } = req.body || {};

        const result = await generateIdeas(process.env.OPENAI_API_KEY, {
            topic,
            slideCount,
            count,
            model: model || DEFAULT_MODEL
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
            process.env.OPENAI_API_KEY
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
            process.env.OPENAI_API_KEY
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
            apiKey: process.env.OPENAI_API_KEY
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

        // Generate Video
        const jobId = uuidv4();
        const outputPath = path.join('./output', `video_${jobId}.mp4`);
        
        // This process might take time, so we could do it async and return a jobId,
        // but for MVP, we will wait for it and return the URL.
        await generateVideo(config, outputPath, jobId);

        let usedTitle = null;
        if (config.storyTitle) {
            usedTitle = saveUsedTitle(config.storyTitle, {
                ideaId: config.storyIdeaId || '',
                narrationSegments: Array.isArray(config.slides)
                    ? config.slides.map(slide => slide.text || '').filter(Boolean)
                    : []
            });
        }

        res.json({
            success: true,
            videoUrl: `/output/video_${jobId}.mp4`,
            usedTitle
        });

    } catch (error) {
        console.error("Error generating video:", error);
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

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
