#!/usr/bin/env node
/**
 * Download royalty-free music for local library
 * Sources:
 * - Pixabay Music API: https://pixabay.com/api/docs/ (requires key)
 * - Freepd.com: No API, manual download required
 * - YouTube Audio Library: https://www.youtube.com/audiolibrary (manual)
 * 
 * USAGE:
 * 1. Get Pixabay API key: https://pixabay.com/api/docs/
 * 2. Set PIXABAY_API_KEY in .env
 * 3. Run: node download-music-library.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const PIXABAY_API_URL = 'https://pixabay.com/api/videos/';
const PIXABAY_API_KEY = process.env.PIXABAY_API_KEY;

const MUSIC_LIBRARY_PATH = path.join(__dirname, 'services', 'music-library');

// Mood-to-search mapping
const MOOD_QUERIES = {
    upbeat: { query: 'upbeat happy energetic music', count: 3 },
    calm: { query: 'calm relaxing peaceful music', count: 3 },
    dramatic: { query: 'dramatic intense suspenseful music', count: 3 },
    cinematic: { query: 'cinematic epic orchestral music', count: 3 },
    corporate: { query: 'corporate professional business jazz', count: 3 },
    chill: { query: 'chill ambient lofi background music', count: 3 },
    motivational: { query: 'motivational inspiring uplifting music', count: 3 },
    dark: { query: 'dark eerie mysterious horror music', count: 3 }
};

/**
 * Download file from URL
 */
async function downloadFile(url, dest) {
    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 60000
        });

        const dir = path.dirname(dest);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        const writer = fs.createWriteStream(dest);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                const size = fs.statSync(dest).size;
                console.log(`  ✅ Downloaded: ${path.basename(dest)} (${(size / 1024 / 1024).toFixed(1)}MB)`);
                resolve(dest);
            });
            writer.on('error', reject);
        });
    } catch (error) {
        throw new Error(`Download failed: ${error.message}`);
    }
}

/**
 * Download music from Pixabay
 */
async function downloadFromPixabay(mood, query, count) {
    if (!PIXABAY_API_KEY) {
        console.log(`\n❌ PIXABAY_API_KEY not set in .env`);
        console.log(`Get it free at: https://pixabay.com/api/docs/\n`);
        return 0;
    }

    try {
        const response = await axios.get(PIXABAY_API_URL, {
            params: {
                key: PIXABAY_API_KEY,
                q: query,
                min_width: 320,
                min_height: 240,
                per_page: count,
                order: 'popular'
            },
            timeout: 10000
        });

        const videos = response.data?.hits || [];
        if (videos.length === 0) {
            console.log(`  ℹ️ No music found for: ${query}`);
            return 0;
        }

        let downloaded = 0;
        for (let i = 0; i < Math.min(videos.length, count); i++) {
            const video = videos[i];
            const videoFiles = video.videos || {};
            
            // Try to get audio or best video quality
            let url = null;
            if (videoFiles.tiny?.url) url = videoFiles.tiny.url;
            else if (videoFiles.small?.url) url = videoFiles.small.url;
            else if (videoFiles.medium?.url) url = videoFiles.medium.url;
            
            if (!url) continue;

            const filename = `${mood}_${i + 1}_${video.id}.mp4`;
            const dest = path.join(MUSIC_LIBRARY_PATH, mood, filename);

            try {
                await downloadFile(url, dest);
                downloaded++;
            } catch (err) {
                console.log(`  ⚠️ Failed: ${filename} - ${err.message}`);
            }
        }

        return downloaded;
    } catch (error) {
        console.log(`  ❌ Pixabay error: ${error.message}`);
        return 0;
    }
}

/**
 * Main
 */
async function main() {
    console.log('\n🎵 Music Library Download Tool\n');
    console.log('This will download royalty-free music to services/music-library/\n');

    // Check if Pixabay key is available
    if (!PIXABAY_API_KEY) {
        console.log('❌ MISSING PIXABAY_API_KEY!\n');
        console.log('QUICK SETUP:');
        console.log('1. Go to https://pixabay.com/api/docs/');
        console.log('2. Click "Sign in or create a Pixabay account"');
        console.log('3. Copy your API key');
        console.log('4. Add to .env: PIXABAY_API_KEY=<your_key>');
        console.log('5. Run this script again\n');
        
        console.log('📖 ALTERNATIVE (Manual Download):');
        console.log('1. Visit https://www.youtube.com/audiolibrary/');
        console.log('2. Search for royalty-free music by mood');
        console.log('3. Download MP3 files');
        console.log('4. Place in: services/music-library/<mood>/\n');
        process.exit(1);
    }

    console.log('Starting download...\n');

    let totalDownloaded = 0;
    for (const [mood, config] of Object.entries(MOOD_QUERIES)) {
        console.log(`📥 ${mood.toUpperCase()}`);
        const count = await downloadFromPixabay(mood, config.query, config.count);
        totalDownloaded += count;
        console.log();
    }

    console.log(`\n✅ Total downloaded: ${totalDownloaded} music files`);
    console.log(`📂 Location: ${MUSIC_LIBRARY_PATH}\n`);
    
    if (totalDownloaded === 0) {
        console.log('⚠️ No music downloaded. Check your API key and internet connection.');
    } else {
        console.log('Ready to use! Start server and generate videos with auto music selection.\n');
    }
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
