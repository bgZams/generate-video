const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { generateVideo } = require('./services/videoGenerator');

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

// API Endpoint for Form Data with Files
// Accepts multiple images or audio
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
        }

        // Generate Video
        const jobId = uuidv4();
        const outputPath = path.join('./output', `video_${jobId}.mp4`);
        
        // This process might take time, so we could do it async and return a jobId,
        // but for MVP, we will wait for it and return the URL.
        await generateVideo(config, outputPath, jobId);

        res.json({
            success: true,
            videoUrl: `/output/video_${jobId}.mp4`
        });

    } catch (error) {
        console.error("Error generating video:", error);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
