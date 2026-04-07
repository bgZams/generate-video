const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const googleTTS = require('google-tts-api');
const axios = require('axios');
const { execFileSync } = require('child_process');

const FFMPEG_BIN = ffmpegInstaller.path;
ffmpeg.setFfmpegPath(FFMPEG_BIN);
ffmpeg.setFfprobePath(ffprobeInstaller.path);

const FONT_URL = "https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf";
const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'Roboto-Bold.ttf');

// ===== UTILITY FUNCTIONS =====

const ensureFont = async () => {
    const fontDir = path.dirname(FONT_PATH);
    if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });
    if (!fs.existsSync(FONT_PATH)) {
        console.log("Downloading default font...");
        await downloadFile(FONT_URL, FONT_PATH);
    }
};

const downloadFile = async (url, dest) => {
    const response = await axios({ url, method: 'GET', responseType: 'stream' });
    const writer = fs.createWriteStream(dest);
    response.data.pipe(writer);
    await new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
    return dest;
};

const getDuration = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            resolve(parseFloat(metadata.format.duration));
        });
    });
};

const runFFmpeg = (args) => {
    try {
        execFileSync(FFMPEG_BIN, args, { stdio: 'pipe', timeout: 600000 });
    } catch (e) {
        const stderr = e.stderr ? e.stderr.toString().slice(-500) : e.message;
        console.error("FFmpeg Error:", stderr);
        throw new Error("FFmpeg failed: " + stderr.substring(0, 200));
    }
};

// ===== AUTO IMAGE SEARCH =====

const extractKeywords = (text) => {
    const stopWords = ['yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk', 'pada', 'adalah', 'akan', 'sudah', 'juga', 'lebih', 'sangat', 'bisa', 'ada', 'tidak', 'kamu', 'anda', 'saya', 'mereka', 'kita', 'orang', 'secara', 'suka', 'baru', 'pola', 'dapat', 'tetap', 'agar', 'bahwa', 'oleh', 'karena', 'maka', 'tahukah', 'apakah', 'namun', 'jadi', 'pastikan', 'memiliki', 'tinggi', 'seperti', 'hanya', 'telah', 'masih', 'sering', 'pernah'];
    const words = text.toLowerCase()
        .replace(/[^a-zA-Z\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.includes(w));
    const unique = [...new Set(words)];
    return unique.slice(0, 3).join(' ');
};

const autoSearchImage = async (text, destPath, width, height) => {
    const keywords = extractKeywords(text);
    console.log(`  Auto-search keywords: "${keywords}"`);
    const seed = keywords.replace(/\s+/g, '-');
    try {
        const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
        const response = await axios({ url, method: 'GET', responseType: 'arraybuffer', maxRedirects: 5, timeout: 15000 });
        fs.writeFileSync(destPath, response.data);
        console.log(`  Image downloaded (${(response.data.length / 1024).toFixed(0)}KB)`);
        return destPath;
    } catch (e) {
        console.log(`  Picsum failed: ${e.message}`);
    }
    console.log(`  Generating gradient background...`);
    runFFmpeg(['-y', '-f', 'lavfi', '-i', `color=c=0x1a1a2e:s=${width}x${height}:d=1`, '-frames:v', '1', destPath]);
    return destPath;
};

// ===== TTS =====

const generateTTS = async (text, destPath, tempDir, slideIndex) => {
    const safeText = text.replace(/\?/g, '.').replace(/\n/g, '. ');
    const maxLen = 150;
    const words = safeText.split(' ');
    let chunks = [];
    let cur = '';
    words.forEach(w => {
        if ((cur + " " + w).length > maxLen) { chunks.push(cur.trim()); cur = w; }
        else { cur += cur ? " " + w : w; }
    });
    if (cur.trim()) chunks.push(cur.trim());
    console.log(`  TTS: ${chunks.length} chunk(s)`);

    const chunkPaths = [];
    for (let i = 0; i < chunks.length; i++) {
        const base64Audio = await googleTTS.getAudioBase64(chunks[i], { lang: 'id', slow: false, host: 'https://translate.google.com' });
        const chunkPath = path.join(tempDir, `tts_${slideIndex}_${i}.mp3`);
        fs.writeFileSync(chunkPath, Buffer.from(base64Audio, 'base64'));
        chunkPaths.push(chunkPath);
    }

    if (chunkPaths.length === 1) {
        fs.copyFileSync(chunkPaths[0], destPath);
    } else {
        const inputs = chunkPaths.join('|');
        runFFmpeg(['-y', '-i', `concat:${inputs}`, '-acodec', 'copy', destPath]);
    }

    const finalDur = await getDuration(destPath);
    console.log(`  TTS final: ${finalDur}s`);
    return finalDur;
};

// ===== TEXT HELPERS =====

const sanitizeDrawtext = (text) => {
    return text
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/'/g, "\\'")
        .replace(/%/g, '%%');
};

const splitTextToLines = (text, maxLen = 30) => {
    const words = text.split(' ');
    let lines = [];
    let currentLine = '';
    words.forEach(word => {
        if ((currentLine + word).length > maxLen) { lines.push(currentLine.trim()); currentLine = word + ' '; }
        else { currentLine += word + ' '; }
    });
    if (currentLine.trim()) lines.push(currentLine.trim());
    return lines.join('\n');
};

// ===== 8 KEN BURNS PRESETS (time-based with totalFrames) =====

const getKenBurnsPreset = (presetIndex, width, height, totalFrames) => {
    const w = parseInt(width);
    const h = parseInt(height);
    const tf = totalFrames;

    const presets = [
        { name: 'Slow Zoom In',
          filter: `zoompan=z='1.0+0.25*on/${tf}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${tf}:s=${w}x${h}:fps=30` },
        { name: 'Slow Zoom Out',
          filter: `zoompan=z='1.25-0.25*on/${tf}':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=${tf}:s=${w}x${h}:fps=30` },
        { name: 'Pan Left to Right',
          filter: `zoompan=z='1.15':x='(iw-iw/zoom)*on/${tf}':y='(ih-ih/zoom)/2':d=${tf}:s=${w}x${h}:fps=30` },
        { name: 'Pan Right to Left',
          filter: `zoompan=z='1.15':x='(iw-iw/zoom)*(${tf}-on)/${tf}':y='(ih-ih/zoom)/2':d=${tf}:s=${w}x${h}:fps=30` },
        { name: 'Pan Top to Bottom',
          filter: `zoompan=z='1.15':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*on/${tf}':d=${tf}:s=${w}x${h}:fps=30` },
        { name: 'Pan Bottom to Top',
          filter: `zoompan=z='1.15':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)*(${tf}-on)/${tf}':d=${tf}:s=${w}x${h}:fps=30` },
        { name: 'Zoom In + Drift ↘',
          filter: `zoompan=z='1.0+0.2*on/${tf}':x='(iw-iw/zoom)*(0.2+0.5*on/${tf})':y='(ih-ih/zoom)*(0.2+0.5*on/${tf})':d=${tf}:s=${w}x${h}:fps=30` },
        { name: 'Zoom Out + Drift ↗',
          filter: `zoompan=z='1.2-0.2*on/${tf}':x='(iw-iw/zoom)*(0.7-0.5*on/${tf})':y='(ih-ih/zoom)*(0.7-0.5*on/${tf})':d=${tf}:s=${w}x${h}:fps=30` }
    ];

    return presets[presetIndex % presets.length];
};

// ===== IMAGE REFERENCE RESOLVER =====

const resolveImageRefs = (slides) => {
    const resolvedSource = new Array(slides.length).fill(null);
    for (let i = 0; i < slides.length; i++) {
        if (slides[i].imageSource === 'ref' && slides[i].refSlide != null) {
            let target = slides[i].refSlide;
            const visited = new Set([i]);
            while (target != null && !visited.has(target) && target < slides.length) {
                if (slides[target].imageSource === 'ref' && slides[target].refSlide != null) {
                    visited.add(target);
                    target = slides[target].refSlide;
                } else { break; }
            }
            resolvedSource[i] = target;
        }
    }
    return resolvedSource;
};

// ===== GROUP CONSECUTIVE SAME-IMAGE SLIDES =====

const groupConsecutiveSlides = (slides, imageCache) => {
    const groups = [];
    let cur = null;
    for (let i = 0; i < slides.length; i++) {
        const img = imageCache[i];
        if (cur && cur.imagePath === img) {
            cur.indices.push(i);
        } else {
            if (cur) groups.push(cur);
            cur = { imagePath: img, indices: [i] };
        }
    }
    if (cur) groups.push(cur);
    return groups;
};

// ===== MAIN PIPELINE =====

const generateVideo = async (config, finalOutputPath, jobId) => {
    await ensureFont();
    const tempDir = path.join(__dirname, '..', 'temp', jobId);
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

    const resolutionMap = { "9:16": "1080x1920", "16:9": "1920x1080", "1:1": "1080x1080" };
    const res = resolutionMap[config.resolution || "9:16"];
    const [width, height] = res.split('x');

    const tempFontPath = path.join(tempDir, 'font.ttf');
    fs.copyFileSync(FONT_PATH, tempFontPath);
    const fontForFilter = tempFontPath.replace(/\\/g, '/').replace(/:/g, '\\:');

    try {
        // === Phase 1: Resolve image references ===
        console.log('\n=== Phase 1: Resolving image references ===');
        const resolvedRefs = resolveImageRefs(config.slides);

        // === Phase 2: Fetch all unique images ===
        console.log('\n=== Phase 2: Fetching images ===');
        const imageCache = {};
        for (let i = 0; i < config.slides.length; i++) {
            const slide = config.slides[i];
            if (slide.imageSource === 'ref' && resolvedRefs[i] != null) continue;

            let imagePath = slide.localImagePath;
            const imgDest = path.join(tempDir, `slide_${i}_img.jpg`);
            if (slide.imageSource === 'auto' || (!imagePath && !slide.imageUrl)) {
                imagePath = await autoSearchImage(slide.text || 'abstract background', imgDest, width, height);
            } else if (slide.imageSource === 'url' && slide.imageUrl) {
                imagePath = imgDest;
                await downloadFile(slide.imageUrl, imagePath);
            } else if (!imagePath) {
                imagePath = await autoSearchImage(slide.text || 'abstract background', imgDest, width, height);
            }
            imageCache[i] = imagePath;
        }
        // Resolve refs
        for (let i = 0; i < config.slides.length; i++) {
            if (resolvedRefs[i] != null && imageCache[resolvedRefs[i]]) {
                imageCache[i] = imageCache[resolvedRefs[i]];
            } else if (!imageCache[i]) {
                const imgDest = path.join(tempDir, `slide_${i}_img.jpg`);
                imageCache[i] = await autoSearchImage(config.slides[i].text || 'abstract background', imgDest, width, height);
            }
        }

        // === Phase 3: Generate TTS for all slides ===
        console.log('\n=== Phase 3: Generating TTS ===');
        const slideAudioPaths = [];
        const slideAudioDurations = [];
        for (let i = 0; i < config.slides.length; i++) {
            console.log(`\n  Slide ${i + 1} TTS:`);
            const audioPath = path.join(tempDir, `slide_${i}_audio.mp3`);
            const spokenText = config.slides[i].text || "Slide ini tidak memiliki teks.";
            const dur = await generateTTS(spokenText, audioPath, tempDir, i);
            slideAudioPaths.push(audioPath);
            slideAudioDurations.push(dur);
        }

        // === Phase 4: Group consecutive slides by image ===
        console.log('\n=== Phase 4: Grouping slides ===');
        const groups = groupConsecutiveSlides(config.slides, imageCache);
        console.log(`  ${groups.length} group(s) from ${config.slides.length} slides`);

        // === Phase 5: Render each group as ONE continuous segment ===
        const groupVideos = [];
        for (let g = 0; g < groups.length; g++) {
            const group = groups[g];
            const indices = group.indices;

            // Calculate time segments
            const PADDING = 0.5;
            let offset = 0;
            const segments = indices.map(idx => {
                const audioDur = slideAudioDurations[idx];
                const segDur = audioDur + PADDING;
                const seg = { idx, start: offset, end: offset + segDur, dur: segDur };
                offset += segDur;
                return seg;
            });
            const totalDur = offset;
            const totalFrames = Math.ceil(totalDur * 30);

            console.log(`\n--- Group ${g + 1}: Slides [${indices.map(i => i + 1).join(',')}], ${totalDur.toFixed(1)}s, ${totalFrames} frames ---`);

            // Build group audio: pad each slide audio then concatenate
            const groupAudioPath = path.join(tempDir, `group_${g}_audio.mp3`);
            const paddedPaths = [];
            for (const seg of segments) {
                const padded = path.join(tempDir, `slide_${seg.idx}_padded.mp3`);
                runFFmpeg(['-y', '-i', slideAudioPaths[seg.idx], '-af', 'apad', '-t', String(seg.dur), '-ar', '44100', '-ac', '2', padded]);
                paddedPaths.push(padded);
            }
            if (paddedPaths.length === 1) {
                fs.copyFileSync(paddedPaths[0], groupAudioPath);
            } else {
                const concatList = path.join(tempDir, `group_${g}_audiolist.txt`);
                fs.writeFileSync(concatList, paddedPaths.map(p => `file '${p.replace(/\\/g, '/')}'`).join('\n'));
                runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatList, '-ar', '44100', '-ac', '2', groupAudioPath]);
            }
            const groupAudioDur = await getDuration(groupAudioPath);
            console.log(`  Group audio: ${groupAudioDur.toFixed(1)}s`);

            // Build video filter: scale → zoompan → timed drawtext per slide
            const preset = getKenBurnsPreset(g, width, height, totalFrames);
            console.log(`  Motion: ${preset.name}`);

            const drawTexts = segments.map(seg => {
                const text = config.slides[seg.idx].text || "";
                if (!text.trim()) return null;
                const display = sanitizeDrawtext(splitTextToLines(text));
                const st = seg.start.toFixed(3);
                const en = seg.end.toFixed(3);
                return `drawtext=fontfile='${fontForFilter}':text='${display}':fontcolor=white:fontsize=64:x=(w-text_w)/2:y=(h-text_h)/2+200:shadowcolor=black:shadowx=2:shadowy=2:borderw=3:bordercolor=black:box=1:boxcolor=black@0.5:boxborderw=20:enable='between(t\\,${st}\\,${en})'`;
            }).filter(Boolean);

            const vfChain = [`scale=iw*2:ih*2`, preset.filter, ...drawTexts].join(',');

            // Render continuous video from single image (NO -loop, zoompan d=totalFrames)
            const silentPath = path.join(tempDir, `group_${g}_silent.mp4`);
            console.log(`  Rendering video...`);
            runFFmpeg([
                '-y', '-i', group.imagePath,
                '-vf', vfChain,
                '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-r', '30', '-an',
                silentPath
            ]);
            const silentDur = await getDuration(silentPath);
            console.log(`  Silent video: ${silentDur.toFixed(1)}s`);

            // Mux audio
            const groupVideoPath = path.join(tempDir, `group_${g}_final.mp4`);
            runFFmpeg([
                '-y', '-i', silentPath, '-i', groupAudioPath,
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
                groupVideoPath
            ]);
            const gvDur = await getDuration(groupVideoPath);
            console.log(`  Group video: ${gvDur.toFixed(1)}s ✓`);

            groupVideos.push(groupVideoPath);
        }

        // === Phase 6: Concatenate all groups ===
        console.log(`\n--- Concatenating ${groupVideos.length} group(s) ---`);
        const concatListPath = path.join(tempDir, 'concat.txt');
        fs.writeFileSync(concatListPath, groupVideos.map(v => `file '${v.replace(/\\/g, '/')}'`).join('\n'));

        const concatedPath = path.join(tempDir, 'concated.mp4');
        runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', concatedPath]);
        const concatDur = await getDuration(concatedPath);
        console.log(`  Concatenated: ${concatDur.toFixed(1)}s`);

        // === Phase 7: Add Background Music ===
        let bgmPath = config.localBgmPath;
        if (!bgmPath && config.bgmUrl) {
            bgmPath = path.join(tempDir, 'bgm.mp3');
            await downloadFile(config.bgmUrl, bgmPath);
        }
        if (!bgmPath) {
            bgmPath = path.join(tempDir, 'auto_bgm.mp3');
            try {
                await downloadFile("https://raw.githubusercontent.com/rafaelreis-hotmart/Audio-Sample-files/master/sample.mp3", bgmPath);
            } catch (e) {
                console.log("  BGM download failed, continuing without music.");
                bgmPath = null;
            }
        }

        if (bgmPath && fs.existsSync(bgmPath)) {
            console.log("  Mixing BGM...");
            const filterComplex = '[0:a]volume=1.0[a1];[1:a]aloop=loop=-1:size=2e+09,volume=0.15[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=2[aout]';
            runFFmpeg([
                '-y', '-i', concatedPath, '-i', bgmPath,
                '-filter_complex', filterComplex,
                '-map', '0:v', '-map', '[aout]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                finalOutputPath
            ]);
        } else {
            fs.copyFileSync(concatedPath, finalOutputPath);
        }

        const finalDur = await getDuration(finalOutputPath);
        console.log(`\n=== Done! ${finalDur.toFixed(1)}s video saved ===`);

    } catch (err) {
        console.error("Pipeline error:", err);
        throw err;
    } finally {
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true, force: true });
        }
    }

    return finalOutputPath;
};

module.exports = { generateVideo };
