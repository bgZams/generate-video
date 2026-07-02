const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const axios = require('axios');
const { execFileSync } = require('child_process');
const captionService = require('./captionService');
const { sanitizeDrawtext } = require('./captionService');
const edgeTts = require('./edgeTtsService');

// Prefer a binary that has modern filters (xfade, etc.). Order:
//   1. System FFmpeg (usually a full build)
//   2. ffmpeg-static (newer, includes xfade/acrossfade)
//   3. @ffmpeg-installer/ffmpeg (older, missing xfade)
const FFMPEG_BIN = (() => {
    if (fs.existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
    if (fs.existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
    try {
        const staticPath = require('ffmpeg-static');
        if (staticPath && fs.existsSync(staticPath)) return staticPath;
    } catch (_) { /* optional dep */ }
    return ffmpegInstaller.path;
})();

const FFPROBE_BIN = (() => {
    if (fs.existsSync('/usr/bin/ffprobe')) return '/usr/bin/ffprobe';
    if (fs.existsSync('/usr/local/bin/ffprobe')) return '/usr/local/bin/ffprobe';
    return ffprobeInstaller.path;
})();

ffmpeg.setFfmpegPath(FFMPEG_BIN);
ffmpeg.setFfprobePath(FFPROBE_BIN);

console.log(`🎬 Video Generator: Using FFmpeg at ${FFMPEG_BIN}`);

// Detect optional filter availability once at module load.
// The pre-built @ffmpeg-installer bundle ships WITHOUT some filters (notably xfade),
// so we need graceful fallback. `fade`, `drawbox`, `drawtext`, and `acrossfade` are
// virtually always present.
const FFMPEG_FILTERS = (() => {
    try {
        const out = execFileSync(FFMPEG_BIN, ['-hide_banner', '-filters'], { timeout: 10000 });
        return out.toString();
    } catch (e) {
        return '';
    }
})();
const HAS_XFADE      = /\bxfade\b/.test(FFMPEG_FILTERS);
const HAS_ACROSSFADE = /\bacrossfade\b/.test(FFMPEG_FILTERS);
console.log(`🎬 FFmpeg filters: xfade=${HAS_XFADE ? 'yes' : 'no'}, acrossfade=${HAS_ACROSSFADE ? 'yes' : 'no'}`);

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
    let newArgs = [];
    const tempFiles = [];
    try {
        // Windows command line limit is 8191 chars.
        // Intercept long filters and write them to a script file.
        for (let i = 0; i < args.length; i++) {
            if (args[i] === '-filter_complex' || args[i] === '-vf') {
                const filterStr = args[i + 1];
                if (filterStr && filterStr.length > 2000) {
                    // Make sure temp directory exists
                    const tempDir = path.join(__dirname, '..', 'temp');
                    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
                    
                    const tempScriptPath = path.join(tempDir, `filter_${Date.now()}_${Math.random().toString(36).substring(7)}.txt`);
                    // FFmpeg script files should ideally be UTF-8
                    fs.writeFileSync(tempScriptPath, filterStr, 'utf8');
                    tempFiles.push(tempScriptPath);
                    
                    if (args[i] === '-filter_complex') {
                        newArgs.push('-filter_complex_script', tempScriptPath);
                    } else {
                        newArgs.push('-filter_script:v', tempScriptPath);
                    }
                    i++;
                    continue;
                }
            }
            newArgs.push(args[i]);
        }
        // Increase timeout to 1 hour (3600000 ms) for long-form video rendering
        execFileSync(FFMPEG_BIN, newArgs, { stdio: 'pipe', timeout: 3600000 });
    } catch (e) {
        const stderr = e.stderr ? e.stderr.toString().slice(-500) : e.message;
        console.error("FFmpeg Error:", stderr);
        throw new Error("FFmpeg failed: " + stderr.substring(0, 200));
    } finally {
        for (const file of tempFiles) {
            try { if (fs.existsSync(file)) fs.unlinkSync(file); } catch (_) {}
        }
    }
};

// ===== AUTO IMAGE SEARCH (Pexels → Picsum → Gradient fallback) =====

const PEXELS_API_KEY_IMG = process.env.PEXELS_API_KEY;
const PEXELS_PHOTO_API   = 'https://api.pexels.com/v1/search';

// In-memory cache per job: query → localPath (avoid re-downloading same photo)
const _imgCache = new Map();

const extractKeywords = (text) => {
    const stopWords = ['yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk', 'pada', 'adalah', 'akan', 'sudah', 'juga', 'lebih', 'sangat', 'bisa', 'ada', 'tidak', 'kamu', 'anda', 'saya', 'mereka', 'kita', 'orang', 'secara', 'suka', 'baru', 'pola', 'dapat', 'tetap', 'agar', 'bahwa', 'oleh', 'karena', 'maka', 'tahukah', 'apakah', 'namun', 'jadi', 'pastikan', 'memiliki', 'tinggi', 'seperti', 'hanya', 'telah', 'masih', 'sering', 'pernah', 'setiap', 'semua', 'kita', 'ini', 'itu', 'oleh', 'jika', 'maka', 'sudah', 'pun', 'pula', 'lalu', 'kemudian', 'setelah', 'sebelum', 'ketika'];
    const words = text.toLowerCase()
        .replace(/[^a-zA-Z\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3 && !stopWords.includes(w));
    const unique = [...new Set(words)];
    return unique.slice(0, 3).join(' ');
};

// Translate common Indonesian keywords to English for better Pexels results
const ID_TO_EN = {
    'motivasi': 'motivation', 'inspirasi': 'inspiration', 'sukses': 'success',
    'kehidupan': 'life', 'alam': 'nature', 'hutan': 'forest', 'laut': 'ocean',
    'gunung': 'mountain', 'kota': 'city', 'bisnis': 'business', 'uang': 'money',
    'keluarga': 'family', 'cinta': 'love', 'islam': 'mosque', 'masjid': 'mosque',
    'doa': 'prayer', 'hati': 'heart', 'damai': 'peace', 'bahagia': 'happy',
    'waktu': 'time', 'dunia': 'world', 'manusia': 'human', 'bumi': 'earth',
    'langit': 'sky', 'bintang': 'stars', 'matahari': 'sun', 'bulan': 'moon',
    'fakta': 'facts', 'sejarah': 'history', 'teknologi': 'technology',
    'sains': 'science', 'makanan': 'food', 'kesehatan': 'health',
    'olahraga': 'sport', 'pendidikan': 'education', 'hijrah': 'journey',
};

function translateKeywords(text) {
    let result = text.toLowerCase();
    for (const [id, en] of Object.entries(ID_TO_EN)) {
        if (result.includes(id)) result = result.replace(new RegExp(id, 'g'), en);
    }
    return result;
}

const autoSearchImage = async (text, destPath, width, height) => {
    const cacheKey = `${text.slice(0, 60)}_${width}x${height}`;
    if (_imgCache.has(cacheKey)) {
        const cached = _imgCache.get(cacheKey);
        if (cached !== destPath && require('fs').existsSync(cached)) {
            require('fs').copyFileSync(cached, destPath);
            console.log(`  Image from cache`);
            return destPath;
        }
    }

    const rawKeywords = extractKeywords(text);
    const engKeywords = translateKeywords(rawKeywords) || 'landscape nature';
    console.log(`  Image search: "${rawKeywords}" → "${engKeywords}"`);

    // --- Tier 1: Pexels Photos API ---
    if (PEXELS_API_KEY_IMG) {
        try {
            const orientation = parseInt(height) > parseInt(width) ? 'portrait' : 'landscape';
            const page = Math.floor(Math.random() * 5) + 1; // random page 1-5 for variety
            const response = await axios.get(PEXELS_PHOTO_API, {
                headers: { Authorization: PEXELS_API_KEY_IMG },
                params: { query: engKeywords, per_page: 10, page, orientation },
                timeout: 12000
            });
            const photos = response.data?.photos || [];
            if (photos.length > 0) {
                const pick = photos[Math.floor(Math.random() * photos.length)];
                // Choose size closest to our resolution
                const imgUrl = parseInt(width) >= 1080
                    ? (pick.src.large2x || pick.src.large || pick.src.original)
                    : (pick.src.large || pick.src.medium);
                const imgResp = await axios({ url: imgUrl, method: 'GET', responseType: 'arraybuffer', maxRedirects: 5, timeout: 20000 });
                require('fs').writeFileSync(destPath, imgResp.data);
                console.log(`  ✅ Pexels image: ${pick.alt || engKeywords} (${(imgResp.data.length/1024).toFixed(0)}KB)`);
                _imgCache.set(cacheKey, destPath);
                return destPath;
            }
        } catch (e) {
            console.log(`  ⚠️ Pexels failed (${e.message?.slice(0, 60)}), trying Picsum...`);
        }
    }

    // --- Tier 2: Picsum (random but deterministic per keyword) ---
    try {
        const seed = rawKeywords.replace(/\s+/g, '-') || 'abstract';
        const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
        const response = await axios({ url, method: 'GET', responseType: 'arraybuffer', maxRedirects: 5, timeout: 15000 });
        require('fs').writeFileSync(destPath, response.data);
        console.log(`  Image from Picsum (${(response.data.length/1024).toFixed(0)}KB)`);
        _imgCache.set(cacheKey, destPath);
        return destPath;
    } catch (e) {
        console.log(`  Picsum failed: ${e.message}`);
    }

    // --- Tier 3: FFmpeg gradient fallback ---
    console.log(`  Generating gradient background...`);
    const colors = ['0x1a1a2e', '0x16213e', '0x0f3460', '0x1b1b2f', '0x2c003e'];
    const color = colors[Math.floor(Math.random() * colors.length)];
    runFFmpeg(['-y', '-f', 'lavfi', '-i', `color=c=${color}:s=${width}x${height}:d=1`, '-frames:v', '1', destPath]);
    return destPath;
};

// ===== TTS =====

// Internal TTS — digunakan hanya jika pipeline TIDAK menerima audioPath
// pre-rendered. Menggunakan Edge TTS (natural, gratis).
const generateTTS = async (text, destPath, tempDir, slideIndex, voiceOption) => {
    const safeText = text.replace(/\n/g, '. ');
    const useVoice = voiceOption || edgeTts.DEFAULT_EDGE_VOICE;
    const buf = await edgeTts.generateEdgeAudio(safeText, useVoice, 1.0);
    fs.writeFileSync(destPath, buf);
    const finalDur = await getDuration(destPath);
    console.log(`  TTS (edge:${useVoice}): ${finalDur.toFixed(2)}s`);
    return finalDur;
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

    // Kalau presetIndex null/undefined -> random (anti-pola "selalu urut").
    // Video monetization-friendly: tiap render punya motion yg tidak predictable.
    if (presetIndex == null || presetIndex < 0) {
        return presets[Math.floor(Math.random() * presets.length)];
    }
    return presets[presetIndex % presets.length];
};

// ===== VISUAL EFFECTS PRESETS =====

const getVisualEffectFilters = (effect, hasVignette) => {
    let filters = [];
    
    switch (effect) {
        case 'cinematic':
            // High contrast, slight teal/orange shift
            filters.push('eq=contrast=1.15:brightness=0.02:saturation=1.1');
            filters.push('colorbalance=rh=0.05:gh=-0.02:bh=-0.1:rs=-0.05:gs=0:bs=0.05');
            break;
        case 'retro':
            // Noise, vintage tint, lower saturation
            filters.push('noise=alls=8:allf=t+u');
            filters.push('eq=saturation=0.7:contrast=0.9');
            filters.push('colorbalance=rs=0.1:gs=0:bs=-0.05'); // Reddish/Yellowish tint
            break;
        case 'vibrant':
            filters.push('eq=saturation=1.5:contrast=1.1');
            break;
        case 'warm':
            filters.push('colorbalance=rs=0.12:gs=0.06:bs=-0.1');
            break;
        case 'cool':
            filters.push('colorbalance=rs=-0.1:gs=0.02:bs=0.15');
            break;
        case 'grayscale':
            filters.push('hue=s=0');
            break;
    }

    if (hasVignette) {
        filters.push('vignette=PI/4');
    }

    return filters;
};

// ===== PROGRESS BAR + BRANDING OVERLAYS =====

/**
 * Thin yellow progress bar at the bottom of the video.
 * Grows from 0→full over the whole video duration.
 */
const buildProgressBarFilter = (totalDur, videoWidth, videoHeight, color = 'yellow') => {
    const barH = Math.max(6, Math.round(videoHeight * 0.008));
    // Track (dimmed black) + accent (yellow) overlaid on top, width = t/total * width
    return [
        `drawbox=x=0:y=ih-${barH}:w=iw:h=${barH}:color=black@0.55:t=fill`,
        `drawbox=x=0:y=ih-${barH}:w='iw*t/${totalDur.toFixed(3)}':h=${barH}:color=${color}:t=fill`
    ].join(',');
};

/**
 * Channel-name watermark to deter re-uploads and reinforce original-creator
 * signals for YouTube Partner Program review. Placed near the top-right so it
 * survives typical crop-and-reupload attacks (which usually trim bottom UI /
 * progress bars). Semi-transparent with stroke + shadow to stay legible across
 * any background while remaining unobtrusive for viewers.
 */
const buildBrandingFilter = (channelName, fontPath, videoWidth, videoHeight) => {
    if (!channelName || !fontPath) return null;
    const handle = String(channelName).trim().replace(/^@+/, '');
    if (!handle) return null;
    const safe = sanitizeDrawtext(`@${handle}`);
    const fontSize = Math.max(22, Math.round(videoHeight * 0.022));
    const yPos = Math.round(videoHeight * 0.035);
    const xMargin = Math.round(videoWidth * 0.03);
    return [
        `drawtext=fontfile='${fontPath}'`,
        `text='${safe}'`,
        `fontcolor=white@0.9`,
        `fontsize=${fontSize}`,
        `borderw=${Math.max(3, Math.round(fontSize * 0.1))}`,
        `bordercolor=black@0.95`,
        `shadowcolor=black@0.7`,
        `shadowx=2`,
        `shadowy=2`,
        `box=1`,
        `boxcolor=black@0.4`,
        `boxborderw=${Math.round(fontSize * 0.35)}`,
        `x=w-text_w-${xMargin}`,
        `y=${yPos}`
    ].join(':');
};

const composeOverlayChain = (parts) => parts.filter(Boolean).join(',');

/**
 * Per-group fade-in from black for the very first group (avoid abrupt start).
 */
const buildGroupFadeFilter = (dur, isFirst, isLast, fadeDur = 0.25) => {
    const parts = [];
    if (isFirst) parts.push(`fade=t=in:st=0:d=${fadeDur}`);
    if (isLast)  parts.push(`fade=t=out:st=${Math.max(0, dur - fadeDur).toFixed(3)}:d=${fadeDur}`);
    return parts.join(',');
};

// Rotating pool of "cinematic" xfade transitions
const XFADE_POOL = [
    'fade',
    'fadeblack',
    'slideleft',
    'smoothleft',
    'circleopen',
    'radial',
    'wipeleft',
    'dissolve'
];

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

        // === Phase 3: Generate TTS for all slides (respect pre-made high-quality audio) ===
        console.log('\n=== Phase 3: Generating TTS ===');
        const slideAudioPaths = [];
        const slideAudioDurations = [];
        for (let i = 0; i < config.slides.length; i++) {
            const slide = config.slides[i];
            const audioPath = path.join(tempDir, `slide_${i}_audio.mp3`);

            // If a pre-generated audio file is provided (e.g. OpenAI TTS from automation
            // pipeline), use it instead of re-generating with Google TTS.
            if (slide.audioPath && fs.existsSync(slide.audioPath)) {
                console.log(`\n  Slide ${i + 1}: using pre-made audio (${path.basename(slide.audioPath)})`);
                fs.copyFileSync(slide.audioPath, audioPath);
                const dur = await getDuration(audioPath);
                slideAudioPaths.push(audioPath);
                slideAudioDurations.push(dur);
                continue;
            }

            console.log(`\n  Slide ${i + 1} TTS:`);
            const spokenText = slide.text || "Slide ini tidak memiliki teks.";
            const dur = await generateTTS(spokenText, audioPath, tempDir, i, config.ttsVoice);
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
            const PADDING = 0.3;
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

            // Build video filter: scale → zoompan → timed drawtext per slide.
            // Motion dipilih RANDOM per group (bukan modulo urutan grup) supaya
            // video beruntun tidak punya pola motion yang sama — mengurangi
            // risiko flag "templated content" saat review monetisasi.
            const preset = getKenBurnsPreset(-1, width, height, totalFrames);
            console.log(`  Motion: ${preset.name}`);

            // === Submagic-style word-chunk captions ===
            // Captions are driven by the real audio duration of each slide
            // (not the padded segment duration), so they end when speech ends.
            const captionsEnabled = config.captions !== false; // default ON
            const chunkSize = Number.isFinite(config.captionChunkSize)
                ? Math.max(1, Math.min(4, config.captionChunkSize))
                : 2; // 2 words/chunk = tight Submagic look
            const accentColor = config.captionAccent || 'yellow';

            const drawTexts = [];
            if (captionsEnabled) {
                segments.forEach(seg => {
                    const text = config.slides[seg.idx].text || '';
                    if (!text.trim()) return;
                    const audioDur = slideAudioDurations[seg.idx] || seg.dur;
                    const slideFilters = captionService.buildCaptionFiltersFromText(
                        text,
                        audioDur,
                        {
                            fontPath: fontForFilter,
                            videoWidth: parseInt(width),
                            videoHeight: parseInt(height),
                            timeOffset: seg.start,
                            chunkSize,
                            accentColor
                        }
                    );
                    drawTexts.push(...slideFilters);
                });
            }

            const effectFilters = getVisualEffectFilters(config.visualEffect || 'none', config.vignette);
            const vfChain = [`scale=iw*2:ih*2`, preset.filter, ...effectFilters, ...drawTexts].join(',');

            // Render continuous video from single image (NO -loop, zoompan d=totalFrames)
            const silentPath = path.join(tempDir, `group_${g}_silent.mp4`);
            console.log(`  Rendering video...`);
            
            runFFmpeg([
                '-y',
                '-loop', '1',
                '-i', group.imagePath,
                '-vf', vfChain,
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-r', '30',
                '-t', String(totalDur),
                '-an',
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

        // === Phase 6: Join groups with cinematic XFADE transitions + progress bar ===
        console.log(`\n--- Joining ${groupVideos.length} group(s) with transitions ---`);
        // If FFmpeg build lacks xfade, silently degrade to plain concat (still gives
        // clean cuts). Captions + progress bar still apply because those only need
        // drawtext/drawbox which are universally available.
        const transitionsEnabled = (config.transitions !== false) && HAS_XFADE;
        if ((config.transitions !== false) && !HAS_XFADE) {
            console.log('  ⚠️ xfade filter not available in this FFmpeg build — using hard cuts.');
        }
        const progressBarEnabled = config.progressBar !== false; // default ON
        const brandingFilter = buildBrandingFilter(config.channelName, fontForFilter, parseInt(width), parseInt(height));
        if (brandingFilter) console.log(`  🔖 Channel watermark: @${String(config.channelName).replace(/^@+/, '')}`);
        const XFADE_DUR = 0.35;

        // Pre-compute per-group durations (xfade offsets need absolute timeline)
        const groupDurations = [];
        for (const gv of groupVideos) {
            groupDurations.push(await getDuration(gv));
        }
        const totalDurEstimated = groupDurations.reduce((s, d) => s + d, 0)
            - (transitionsEnabled ? XFADE_DUR * Math.max(0, groupVideos.length - 1) : 0);

        const concatedPath = path.join(tempDir, 'concated.mp4');

        if (groupVideos.length === 1) {
            // Single group — overlay progress bar and/or branding if enabled
            const pb = progressBarEnabled
                ? buildProgressBarFilter(groupDurations[0], parseInt(width), parseInt(height))
                : null;
            const overlay = composeOverlayChain([pb, brandingFilter]);
            if (overlay) {
                runFFmpeg([
                    '-y', '-i', groupVideos[0],
                    '-vf', overlay,
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30',
                    '-c:a', 'aac', '-b:a', '192k',
                    concatedPath
                ]);
            } else {
                fs.copyFileSync(groupVideos[0], concatedPath);
            }
        } else if (transitionsEnabled) {
            // Build xfade chain across N inputs
            const inputs = groupVideos.flatMap(v => ['-i', v]);
            const filterParts = [];
            let prevVTag = '0:v';
            let prevATag = '0:a';
            let cumOffset = 0;

            for (let i = 1; i < groupVideos.length; i++) {
                cumOffset += groupDurations[i - 1] - XFADE_DUR;
                const isLastPair = i === groupVideos.length - 1;
                const vtag = isLastPair ? 'vxf' : `vx${i}`;
                const atag = isLastPair ? 'axf' : `ax${i}`;
                const trans = XFADE_POOL[(i - 1) % XFADE_POOL.length];
                filterParts.push(`[${prevVTag}][${i}:v]xfade=transition=${trans}:duration=${XFADE_DUR}:offset=${cumOffset.toFixed(3)}[${vtag}]`);
                filterParts.push(`[${prevATag}][${i}:a]acrossfade=d=${XFADE_DUR}:c1=tri:c2=tri[${atag}]`);
                prevVTag = vtag;
                prevATag = atag;
            }

            // Final chain: add progress bar + channel watermark on top of the xfaded video
            let finalVTag = prevVTag;
            const pb = progressBarEnabled
                ? buildProgressBarFilter(totalDurEstimated, parseInt(width), parseInt(height))
                : null;
            const overlayXf = composeOverlayChain([pb, brandingFilter]);
            if (overlayXf) {
                filterParts.push(`[${prevVTag}]${overlayXf}[vout]`);
                finalVTag = 'vout';
            }

            runFFmpeg([
                '-y',
                ...inputs,
                '-filter_complex', filterParts.join(';'),
                '-map', `[${finalVTag}]`,
                '-map', `[${prevATag}]`,
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30',
                '-c:a', 'aac', '-b:a', '192k',
                concatedPath
            ]);
        } else {
            // Fast path: plain concat (no transitions)
            const concatListPath = path.join(tempDir, 'concat.txt');
            fs.writeFileSync(concatListPath, groupVideos.map(v => `file '${v.replace(/\\/g, '/')}'`).join('\n'));
            if (progressBarEnabled || brandingFilter) {
                const rawConcat = path.join(tempDir, 'concat_raw.mp4');
                runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', rawConcat]);
                const rawDur = await getDuration(rawConcat);
                const pb = progressBarEnabled
                    ? buildProgressBarFilter(rawDur, parseInt(width), parseInt(height))
                    : null;
                const overlay = composeOverlayChain([pb, brandingFilter]);
                runFFmpeg([
                    '-y', '-i', rawConcat,
                    '-vf', overlay,
                    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p', '-r', '30',
                    '-c:a', 'aac', '-b:a', '192k',
                    concatedPath
                ]);
            } else {
                runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', concatedPath]);
            }
        }

        const concatDur = await getDuration(concatedPath);
        console.log(`  Final cut: ${concatDur.toFixed(1)}s (transitions: ${transitionsEnabled}, progressBar: ${progressBarEnabled})`);

        // === Phase 7: Add Background Music ===
        let bgmPath = config.localBgmPath;
        if (!bgmPath && config.bgmUrl) {
            bgmPath = path.join(tempDir, 'bgm.mp3');
            try {
                await downloadFile(config.bgmUrl, bgmPath);
            } catch (e) {
                console.log(`  ⚠️ BGM URL download failed: ${e.message}`);
                bgmPath = null;
            }
        }
        
        // Final fallback if still no BGM
        if (!bgmPath) {
            console.log("  ℹ️ No BGM provided, using silent video");
            fs.copyFileSync(concatedPath, finalOutputPath);
        } else if (fs.existsSync(bgmPath)) {
            console.log("  🎵 Mixing Background Music...");
            const isAudioOnly = /\.(mp3|wav|aac|m4a|ogg)$/i.test(bgmPath);
            const bgmAudioPath = path.join(tempDir, 'bgm_final_audio.aac');
            let audioReady = false;
            
            try {
                if (isAudioOnly) {
                    console.log(`  Processed as audio file: ${path.basename(bgmPath)}`);
                    // Just convert to AAC for consistency in mixing
                    runFFmpeg([
                        '-y', '-i', bgmPath,
                        '-acodec', 'aac', '-b:a', '128k',
                        bgmAudioPath
                    ]);
                } else {
                    console.log(`  Extracting audio from video: ${path.basename(bgmPath)}`);
                    runFFmpeg([
                        '-y', '-i', bgmPath,
                        '-vn', '-acodec', 'aac', '-b:a', '128k',
                        bgmAudioPath
                    ]);
                }
                
                // Verify extraction succeeded and has content
                if (fs.existsSync(bgmAudioPath) && fs.statSync(bgmAudioPath).size > 1000) {
                    audioReady = true;
                }
            } catch (e) {
                console.log(`  ⚠️ BGM processing failed: ${e.message}`);
                audioReady = false;
            }

            if (audioReady) {
                // Loop BGM to match video duration if needed
                // volume=0.4 for BGM is usually standard for narration-heavy videos
                const filterComplex = '[0:a]volume=1.0[a1];[1:a]aloop=loop=-1:size=2e+09,volume=0.35[a2];[a1][a2]amix=inputs=2:duration=first:dropout_transition=3[aout]';
                try {
                    runFFmpeg([
                        '-y', '-i', concatedPath, '-i', bgmAudioPath,
                        '-filter_complex', filterComplex,
                        '-map', '0:v', '-map', '[aout]',
                        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                        finalOutputPath
                    ]);
                    console.log("  ✅ BGM mixed successfully");
                } catch (e) {
                    console.log(`  ⚠️ BGM amix failed: ${e.message}, using narration only`);
                    fs.copyFileSync(concatedPath, finalOutputPath);
                }
            } else {
                console.log("  ⚠️ BGM audio stream not found or invalid, using narration only");
                fs.copyFileSync(concatedPath, finalOutputPath);
            }
        } else {
            fs.copyFileSync(concatedPath, finalOutputPath);
        }

        let finalDur = await getDuration(finalOutputPath);

        // Safety cap: hard-trim if caller set maxDurationSec (e.g. Shorts < 60s).
        // Only triggers when we're actually over, so normal-length videos skip
        // the re-encode and keep their full duration.
        const maxDur = Number(config.maxDurationSec) || 0;
        if (maxDur > 0 && finalDur > maxDur) {
            console.log(`  ✂️ Trimming ${finalDur.toFixed(1)}s → ${maxDur}s to satisfy maxDurationSec`);
            const trimmedPath = path.join(tempDir, 'final_trimmed.mp4');
            runFFmpeg([
                '-y', '-i', finalOutputPath,
                '-t', String(maxDur),
                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '22', '-pix_fmt', 'yuv420p',
                '-c:a', 'aac', '-b:a', '192k',
                trimmedPath
            ]);
            fs.copyFileSync(trimmedPath, finalOutputPath);
            finalDur = await getDuration(finalOutputPath);
        }

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
