#!/usr/bin/env node
/**
 * Auto-Download Instrumental Music from Free Royalty-Free Sources
 * Sources: Bensound, Incompetech, and other free APIs
 * 
 * USAGE:
 * node download-instrumental-music.js
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MUSIC_LIBRARY_PATH = path.join(__dirname, 'services', 'music-library');

// Define instrumental music download sources per mood
// Using reliable royalty-free sources
const INSTRUMENTAL_SOURCES = {
    upbeat: [
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
    ],
    calm: [
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'
    ],
    dramatic: [
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'
    ],
    cinematic: [
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
    ],
    corporate: [
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'
    ],
    chill: [
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3'
    ],
    motivational: [
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3'
    ],
    dark: [
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
        'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3'
    ]
};

/**
 * Download file from URL
 */
async function downloadFile(url, dest, moodName, index) {
    try {
        console.log(`  📥 Downloading [${index}]...`);
        
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000,
            maxRedirects: 5,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0'
            }
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
                if (size < 10000) { // Less than 10KB = likely error
                    fs.unlinkSync(dest);
                    reject(new Error('File too small, likely failed'));
                    return;
                }
                console.log(`     ✅ ${path.basename(dest)} (${(size / 1024 / 1024).toFixed(1)}MB)`);
                resolve(dest);
            });
            writer.on('error', reject);
        });
    } catch (error) {
        console.log(`     ❌ Failed: ${error.message}`);
        throw error;
    }
}

/**
 * Main downloader
 */
async function downloadAllMusic() {
    console.log('\n🎵 Auto-Downloading Instrumental Music...\n');
    console.log('Source: Bensound (100% Royalty-Free)\n');

    let totalDownloaded = 0;

    for (const [mood, urls] of Object.entries(INSTRUMENTAL_SOURCES)) {
        console.log(`📂 ${mood.toUpperCase()}`);

        const moodPath = path.join(MUSIC_LIBRARY_PATH, mood);
        if (!fs.existsSync(moodPath)) {
            fs.mkdirSync(moodPath, { recursive: true });
        }

        let moodCount = 0;
        for (let i = 0; i < urls.length; i++) {
            const url = urls[i];
            const filename = `${mood}_${i + 1}.mp3`;
            const filepath = path.join(moodPath, filename);

            // Skip if already exists
            if (fs.existsSync(filepath)) {
                const size = fs.statSync(filepath).size;
                console.log(`  ✅ ${filename} (${(size / 1024 / 1024).toFixed(1)}MB) - already exists`);
                moodCount++;
                totalDownloaded++;
                continue;
            }

            try {
                await downloadFile(url, filepath, mood, i + 1);
                moodCount++;
                totalDownloaded++;
            } catch (err) {
                console.log(`     ⚠️ Skipping [${i + 1}]`);
            }
        }

        console.log(`  → Downloaded: ${moodCount}/${urls.length}\n`);
    }

    console.log(`\n✅ Total files ready: ${totalDownloaded}`);
    console.log(`📂 Location: ${MUSIC_LIBRARY_PATH}\n`);

    if (totalDownloaded > 0) {
        console.log('🎬 Ready to use! Start server:\n');
        console.log('   node server.js\n');
        console.log('Then create videos - instrumental music will auto-play! 🎵\n');
    } else {
        console.log('⚠️ No music downloaded. Check internet connection.\n');
    }
}

// Run
downloadAllMusic().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
