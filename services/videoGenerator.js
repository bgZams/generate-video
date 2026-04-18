const fs = require('fs');
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
const axios = require('axios');
const { execFileSync } = require('child_process');
const captionService = require('./captionService');
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
            // Single group — just overlay progress bar if enabled, else pass through
            if (progressBarEnabled) {
                const pb = buildProgressBarFilter(groupDurations[0], parseInt(width), parseInt(height));
                runFFmpeg([
                    '-y', '-i', groupVideos[0],
                    '-vf', pb,
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

            // Final chain: add progress bar on top of the xfaded video
            let finalVTag = prevVTag;
            if (progressBarEnabled) {
                const pb = buildProgressBarFilter(totalDurEstimated, parseInt(width), parseInt(height));
                filterParts.push(`[${prevVTag}]${pb}[vout]`);
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
            if (progressBarEnabled) {
                const rawConcat = path.join(tempDir, 'concat_raw.mp4');
                runFFmpeg(['-y', '-f', 'concat', '-safe', '0', '-i', concatListPath, '-c', 'copy', rawConcat]);
                const rawDur = await getDuration(rawConcat);
                const pb = buildProgressBarFilter(rawDur, parseInt(width), parseInt(height));
                runFFmpeg([
                    '-y', '-i', rawConcat,
                    '-vf', pb,
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
