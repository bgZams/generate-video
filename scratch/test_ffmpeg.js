
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testFFmpeg() {
    const ffmpeg = 'C:\\laragon\\www\\jejakhijrahdaily\\node_modules\\@ffmpeg-installer\\win32-x64\\ffmpeg.exe';
    const input = 'test_image.jpg';
    
    // Create a dummy image
    // Note: This might not work on all systems if 'magick' or similar is not there, 
    // but we can try to use ffmpeg to create a color block.
    try {
        execFileSync(ffmpeg, ['-y', '-f', 'lavfi', '-i', 'color=c=blue:s=1080x1920', '-vframes', '1', input]);
        console.log('✅ Dummy image created.');
        
        const output = 'test_output.mp4';
        const filter = "scale=iw*2:ih*2,zoompan=z='1.1':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:d=60";
        
        console.log('Running FFmpeg WITHOUT -loop 1...');
        const start = Date.now();
        try {
            execFileSync(ffmpeg, ['-y', '-i', input, '-vf', filter, '-c:v', 'libx264', '-t', '2', output], { stdio: 'ignore' });
            const stats = fs.statSync(output);
            console.log(`✅ Success. Size: ${stats.size} bytes. Duration: ?`);
            // Check frames if possible
        } catch (e) {
            console.log(`❌ Failed: ${e.message}`);
        }
        
    } catch (e) {
        console.log('Could not create dummy image or run ffmpeg.');
    }
}

testFFmpeg();
