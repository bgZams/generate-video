/**
 * Thumbnail Service
 *
 * Generates an eye-catching YouTube thumbnail from a generated video by:
 *  1. Extracting a frame from early in the video (0.5s is usually visually "hooky")
 *  2. Overlaying a punchy title with high-contrast styling (big bold text,
 *     thick black stroke, yellow accent strip) — same visual DNA as the
 *     Submagic-style captions for brand consistency.
 *
 * Output: PNG at 1280x720 by default (YouTube thumbnail standard). For Shorts
 * we also expose 720x1280 portrait.
 *
 * Notes:
 *  - Uses the same font that videoGenerator downloads (public/fonts/Roboto-Bold.ttf)
 *  - Pure FFmpeg, no extra deps
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

const FFMPEG_BIN = (() => {
    if (fs.existsSync('/usr/bin/ffmpeg')) return '/usr/bin/ffmpeg';
    if (fs.existsSync('/usr/local/bin/ffmpeg')) return '/usr/local/bin/ffmpeg';
    try {
        const staticPath = require('ffmpeg-static');
        if (staticPath && fs.existsSync(staticPath)) return staticPath;
    } catch (_) { /* optional dep */ }
    return ffmpegInstaller.path;
})();

const FONT_PATH = path.join(__dirname, '..', 'public', 'fonts', 'Roboto-Bold.ttf');

function runFFmpeg(args) {
    try {
        execFileSync(FFMPEG_BIN, args, { stdio: 'pipe', timeout: 300000 });
    } catch (e) {
        const stderr = e.stderr ? e.stderr.toString().slice(-500) : e.message;
        throw new Error('Thumbnail FFmpeg failed: ' + stderr.substring(0, 300));
    }
}

function sanitize(text) {
    // See captionService.sanitizeDrawtext: FFmpeg single-quoted strings
    // can't hold a literal "'" via \', so normalize to U+2019 to keep
    // the filtergraph parse stable when titles contain apostrophes.
    return String(text)
        .replace(/['\u2018\u2019\u02BC\u02B9]/g, '\u2019')
        .replace(/["\u201C\u201D]/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/%/g, '\\%')
        .replace(/,/g, '\\,');
}

/**
 * Split title into up to 3 lines of roughly equal length for dramatic stacking.
 */
function wrapTitle(title, maxCharsPerLine = 14) {
    const words = String(title).trim().split(/\s+/);
    if (!words.length) return [''];
    const lines = [];
    let cur = '';
    for (const w of words) {
        if (!cur) { cur = w; continue; }
        if ((cur + ' ' + w).length > maxCharsPerLine) {
            lines.push(cur);
            cur = w;
        } else {
            cur += ' ' + w;
        }
    }
    if (cur) lines.push(cur);
    return lines.slice(0, 3);
}

/**
 * Estimate the font size so the longest title line fits within the canvas width,
 * accounting for a comfortable horizontal margin. Bold fonts are roughly 0.55em
 * wide per character — we use a slightly conservative 0.6 factor.
 */
function computeFontSize(lines, canvasW, canvasH) {
    const longest = lines.reduce((m, l) => Math.max(m, l.length), 1);
    // Ceiling: never exceed 1/7 of canvas height so we have room for stacked lines
    const byHeight = Math.floor(canvasH / 7);
    // Width-constrained: 90% of canvas width divided by estimated glyph width
    const byWidth  = Math.floor((canvasW * 0.90) / (longest * 0.60));
    const fontSize = Math.min(byHeight, byWidth);
    // Floor so headlines don't become unreadable on very long titles
    return Math.max(36, fontSize);
}

/**
 * Build a drawtext chain that stacks the title lines vertically.
 * Each line is drawn with a heavy black stroke + bright yellow "slash"
 * highlight behind every other line for a click-bait look.
 */
function buildTitleFilters(titleLines, opts) {
    const { fontPath, canvasW, canvasH } = opts;
    const fontSize = computeFontSize(titleLines, canvasW, canvasH);
    const lineGap = Math.round(fontSize * 0.15);
    const lineH   = fontSize + lineGap;
    const totalH  = titleLines.length * lineH;
    // Center block vertically (slightly above center for visual balance)
    const startY  = Math.round((canvasH - totalH) / 2 - canvasH * 0.03);

    const filters = [];
    titleLines.forEach((line, i) => {
        const safe = sanitize(line.toUpperCase());
        const y = startY + i * lineH;
        // Alternate accent: odd lines in yellow for pop
        const color = (i % 2 === 1) ? 'yellow' : 'white';
        filters.push([
            `drawtext=fontfile='${fontPath}'`,
            `text='${safe}'`,
            `fontcolor=${color}`,
            `fontsize=${fontSize}`,
            `borderw=${Math.max(6, Math.round(fontSize * 0.1))}`,
            `bordercolor=black`,
            `shadowcolor=black@0.75`,
            `shadowx=4:shadowy=6`,
            `x=(w-text_w)/2`,
            `y=${y}`
        ].join(':'));
    });
    return filters;
}

/**
 * Generate a thumbnail PNG.
 *
 * @param {Object} params
 *   videoPath     - path to source mp4
 *   outputPath    - where to write .png
 *   title         - text to overlay
 *   orientation   - 'landscape' (default 1280x720) | 'portrait' (720x1280)
 *   grabTime      - seconds offset into video to grab frame (default 0.5)
 * @returns {Promise<string>} outputPath
 */
async function generateThumbnail(params) {
    const {
        videoPath,
        outputPath,
        title,
        orientation = 'landscape',
        grabTime = 0.25
    } = params;

    if (!videoPath || !fs.existsSync(videoPath)) {
        throw new Error(`Thumbnail source video not found: ${videoPath}`);
    }
    if (!fs.existsSync(FONT_PATH)) {
        throw new Error(`Font not found at ${FONT_PATH}. Run video pipeline once to download.`);
    }

    const canvasW = orientation === 'portrait' ? 720  : 1280;
    const canvasH = orientation === 'portrait' ? 1280 : 720;

    const outDir = path.dirname(outputPath);
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const fontForFilter = FONT_PATH.replace(/\\/g, '/').replace(/:/g, '\\:');
    const lines = wrapTitle(title || 'YouTube', 18);

    // Filter chain:
    //  1. Scale/crop to canvas
    //  2. Slight darken + saturation boost so white text pops
    //  3. Yellow diagonal accent strip (drawbox rotated look via thick line) bottom-left
    //  4. Title drawtext lines
    const baseFilters = [
        `scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase`,
        `crop=${canvasW}:${canvasH}`,
        `eq=brightness=-0.12:saturation=1.3:contrast=1.2`,
        // Darken whole frame a bit so high-contrast title pops
        `drawbox=x=0:y=0:w=iw:h=ih:color=black@0.25:t=fill`
    ];

    const titleFilters = buildTitleFilters(lines, {
        fontPath: fontForFilter,
        canvasW,
        canvasH
    });

    const vf = [...baseFilters, ...titleFilters].join(',');

    runFFmpeg([
        '-y',
        '-ss', String(grabTime),
        '-i', videoPath,
        '-vframes', '1',
        '-vf', vf,
        '-q:v', '2',
        outputPath
    ]);

    if (!fs.existsSync(outputPath)) {
        throw new Error('Thumbnail file was not produced.');
    }

    console.log(`🖼️  Thumbnail generated: ${outputPath}`);
    return outputPath;
}

module.exports = {
    generateThumbnail,
    wrapTitle
};
