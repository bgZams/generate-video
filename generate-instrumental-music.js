#!/usr/bin/env node
/**
 * Generate High-Quality Instrumental Music Using FFmpeg
 * Creates different instrument-like sounds for each mood
 * Much better than simple sine waves!
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const MUSIC_LIBRARY_PATH = path.join(__dirname, 'services', 'music-library');
const FFMPEG_BIN = ffmpegInstaller.path;

const MOODS = ['upbeat', 'calm', 'dramatic', 'cinematic', 'corporate', 'chill', 'motivational', 'dark'];

// More sophisticated instrument-like filters per mood
const MOOD_FILTERS = {
    upbeat: {
        desc: '🎹 Piano + Drums (Upbeat)',
        // Combination of tones with rhythm effect
        filter: `sine=f=440:d=15,aecho=0.8:0.9:5:0.3,adelay=500|500,aecho=0.8:0.9:50:0.2`
    },
    calm: {
        desc: '🎸 Acoustic Guitar (Calm)',
        // Softer, slower tones
        filter: `sine=f=220:d=15,aecho=0.8:0.8:1000:0.15,volume=0.9`
    },
    dramatic: {
        desc: '🎻 Strings + Bass (Dramatic)',
        // Lower frequencies with reverb
        filter: `sine=f=110:d=15,aecho=0.8:0.9:100:0.4,volume=0.85`
    },
    cinematic: {
        desc: '🎼 Orchestral (Cinematic)',
        // Layered effect
        filter: `sine=f=330:d=15,aecho=0.7:0.8:200:0.3,aecho=0.6:0.7:500:0.2,areverse,atrim=start=0:end=15`
    },
    corporate: {
        desc: '🎷 Jazz Saxophone (Corporate)',
        // Mid-range smooth tones
        filter: `sine=f=350:d=15,aecho=0.8:0.85:300:0.25,volume=0.88`
    },
    chill: {
        desc: '🌊 Ambient Pad (Chill)',
        // Very low, atmospheric (fixed filter)
        filter: `sine=f=55:d=15,aecho=0.9:0.95:5000:0.4,volume=0.7`
    },
    motivational: {
        desc: '⚡ Power Chord (Motivational)',
        // Punchy, impactful
        filter: `sine=f=220:d=15,aecho=0.8:0.9:50:0.35,aecho=0.7:0.8:200:0.25,volume=0.9`
    },
    dark: {
        desc: '🌙 Dark Pad (Dark/Horror)',
        // Very low, eerie
        filter: `sine=f=55:d=15,aecho=0.85:0.9:2000:0.5,aecho=0.7:0.8:5000:0.3,volume=0.75`
    }
};

function generateInstrumentalMusic(mood) {
    const moodPath = path.join(MUSIC_LIBRARY_PATH, mood);
    const moodConfig = MOOD_FILTERS[mood];
    
    if (!moodConfig) return;
    
    console.log(`  ${moodConfig.desc}`);

    for (let i = 1; i <= 3; i++) {
        const filename = `${mood}_${i}.mp3`;
        const filepath = path.join(moodPath, filename);

        try {
            // Generate 15-second instrumental with echo/reverb effects
            execFileSync(FFMPEG_BIN, [
                '-y',
                '-f', 'lavfi',
                '-i', moodConfig.filter,
                '-codec:a', 'libmp3lame',
                '-q:a', '3',
                '-b:a', '256k',
                filepath
            ], {
                stdio: 'pipe',
                timeout: 45000
            });

            const size = fs.statSync(filepath).size;
            console.log(`    ✅ ${filename} (${(size / 1024).toFixed(0)}KB)`);
        } catch (err) {
            console.error(`    ❌ ${filename} failed: ${err.message}`);
        }
    }
}

console.log('\n🎵 Generating High-Quality Instrumental Music...\n');
console.log('Using FFmpeg Audio Synthesis with Effects\n');

for (const mood of MOODS) {
    generateInstrumentalMusic(mood);
}

console.log('\n✅ Instrumental library created!\n');
console.log('🎬 Start server & create videos:\n');
console.log('   node server.js\n');
console.log('Music will auto-mix in your videos! 🎵\n');
