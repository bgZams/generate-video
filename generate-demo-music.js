#!/usr/bin/env node
/**
 * Generate demo audio files for testing
 * Creates simple sine wave tones for each mood
 * User can replace these with real music later
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const MUSIC_LIBRARY_PATH = path.join(__dirname, 'services', 'music-library');
const FFMPEG_BIN = ffmpegInstaller.path;

const MOODS = ['upbeat', 'calm', 'dramatic', 'cinematic', 'corporate', 'chill', 'motivational', 'dark'];

// Different frequencies for different moods (for demo purposes)
const MOOD_FREQ = {
    upbeat: '800',      // Higher pitch = upbeat
    calm: '200',        // Lower pitch = calm
    dramatic: '440',    // Classic A note
    cinematic: '330',   // Lower orchestral
    corporate: '350',   // Professional
    chill: '150',       // Very low = chill
    motivational: '600', // Mid-high
    dark: '100'         // Very low = dark
};

function generateDemoAudio(mood) {
    const moodPath = path.join(MUSIC_LIBRARY_PATH, mood);
    const freq = MOOD_FREQ[mood] || '440';
    
    for (let i = 1; i <= 3; i++) {
        const filename = `${mood}_${i}.mp3`;
        const filepath = path.join(moodPath, filename);
        
        try {
            // Generate 10-second sine wave with HIGHER VOLUME
            // Normalized to prevent clipping, with proper MP3 encoding
            execFileSync(FFMPEG_BIN, [
                '-y',
                '-f', 'lavfi',
                '-i', `sine=f=${freq}:d=10,volume=0.8`,  // 80% volume for better audibility
                '-codec:a', 'libmp3lame',
                '-q:a', '4',                              // Better MP3 quality (lower = better)
                '-b:a', '192k',                           // 192kbps bitrate
                filepath
            ], {
                stdio: 'pipe',
                timeout: 30000
            });
            
            const size = fs.statSync(filepath).size;
            console.log(`✅ ${filename} (${(size/1024).toFixed(0)}KB)`);
        } catch (err) {
            console.error(`❌ ${filename} failed: ${err.message}`);
        }
    }
}

console.log('\n🎵 Generating demo audio files...\n');

for (const mood of MOODS) {
    console.log(`  ${mood.toUpperCase()}:`);
    generateDemoAudio(mood);
}

console.log('\n✅ Demo files ready!\n');
console.log('📂 Location: services/music-library/');
console.log('📝 Note: Replace these with real music from YouTube Audio Library\n');
console.log('To download real music:');
console.log('1. Go to: https://www.youtube.com/audiolibrary/');
console.log('2. Download MP3 for each mood');
console.log('3. Place in services/music-library/<mood>/\n');
