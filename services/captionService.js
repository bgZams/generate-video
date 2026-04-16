/**
 * Caption Service (Submagic / CapCut style burn-in captions)
 *
 * - Splits narration text into 2–3 word chunks
 * - Distributes timing across the audio duration proportional to syllable count
 *   (so longer words stay on screen longer — feels much more natural than equal splits)
 * - Produces FFmpeg drawtext filters that display chunks one at a time,
 *   bold + white + thick black stroke, with a subtle yellow accent on the
 *   "key" word per chunk (longest word) for Submagic-style emphasis.
 */

// --- Tuning knobs -----------------------------------------------------------

const DEFAULT_CHUNK_SIZE = 3;           // words per on-screen chunk
const MIN_CHUNK_SECONDS  = 0.45;        // avoid flickery sub-frame chunks
const INTER_CHUNK_GAP    = 0.04;        // tiny visual breath between chunks

// --- Helpers ----------------------------------------------------------------

function countSyllables(word) {
    // Approx: vowel groups. Works decently for ID + EN.
    const w = (word || '').toLowerCase().replace(/[^a-z]/g, '');
    if (!w) return 0;
    const groups = w.match(/[aeiouy]+/g);
    return Math.max(1, groups ? groups.length : 1);
}

function tokenize(text) {
    return (text || '')
        .replace(/\s+/g, ' ')
        .trim()
        .split(' ')
        .filter(Boolean);
}

/**
 * Break words into chunks of `size`, but also respect a character limit
 * to prevent text overflowing the screen width.
 */
function chunkWords(words, size = DEFAULT_CHUNK_SIZE) {
    const maxChars = 20; // Maximum characters per line/chunk for vertical video
    const stopTails = new Set([
        'yang','dan','di','ke','dari','ini','itu','dengan','untuk','pada',
        'adalah','akan','juga','lebih','bisa','ada','tidak','atau','tapi','namun',
        'atas','bawah','jadi','maka','oleh','karena'
    ]);
    const chunks = [];
    let cur = [];
    let curChars = 0;

    for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordLen = word.length + (cur.length > 0 ? 1 : 0);

        // Break if word count reached OR character limit reached
        if (cur.length >= size || (cur.length > 0 && curChars + wordLen > maxChars)) {
            // Peek next — if next is a tiny stopword and we have room, absorb it
            const next = words[i]; // current word is the "next" in this logic
            if (next && stopTails.has(next.toLowerCase()) && cur.length < size + 1 && curChars + wordLen < maxChars + 5) {
                // absorb (already handled by loop if we don't push yet)
            } else {
                chunks.push(cur);
                cur = [];
                curChars = 0;
            }
        }
        
        cur.push(word);
        curChars += word.length + (cur.length > 1 ? 1 : 0);
    }

    if (cur.length) {
        if (cur.length === 1 && chunks.length > 0 && (chunks[chunks.length-1].join(' ').length + cur[0].length) < maxChars + 5) {
            chunks[chunks.length - 1].push(cur[0]);
        } else {
            chunks.push(cur);
        }
    }
    return chunks;
}

/**
 * Distribute total audio duration across chunks proportional to syllable weight.
 * Returns [{ text, words, startTime, endTime, keyIndex }]
 */
function buildChunkTimings(text, audioDuration, chunkSize = DEFAULT_CHUNK_SIZE) {
    const words = tokenize(text);
    if (!words.length || !audioDuration || audioDuration <= 0) return [];

    const chunks = chunkWords(words, chunkSize);
    const weights = chunks.map(ws => ws.reduce((s, w) => s + countSyllables(w), 0));
    const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;

    // Reserve tiny gaps between chunks
    const totalGap = INTER_CHUNK_GAP * Math.max(0, chunks.length - 1);
    const usable = Math.max(0.2, audioDuration - totalGap);

    let cursor = 0;
    const timings = chunks.map((ws, idx) => {
        let dur = (weights[idx] / totalWeight) * usable;
        if (dur < MIN_CHUNK_SECONDS) dur = MIN_CHUNK_SECONDS;
        const start = cursor;
        const end = cursor + dur;
        cursor = end + INTER_CHUNK_GAP;

        // Key word = longest (most syllables). Highlighted in accent color.
        let keyIndex = 0;
        let keyLen = -1;
        ws.forEach((w, i) => {
            const sy = countSyllables(w);
            if (sy > keyLen) { keyLen = sy; keyIndex = i; }
        });

        return {
            text: ws.join(' '),
            words: ws,
            startTime: start,
            endTime: end,
            keyIndex
        };
    });

    // Re-normalize if cursor overshot audioDuration
    if (cursor > audioDuration && timings.length > 1) {
        const scale = audioDuration / cursor;
        timings.forEach(t => {
            t.startTime *= scale;
            t.endTime *= scale;
        });
    }

    return timings;
}

// --- FFmpeg drawtext builders ----------------------------------------------

function sanitizeDrawtext(text) {
    // IMPORTANT: FFmpeg filtergraph single-quoted strings do NOT support
    // backslash-escaping of an inner single quote. A literal "'" inside
    // text='...' forces the quote to close early, which corrupts the rest
    // of the filter chain (downstream options like enable='between(...)'
    // end up consuming the following filter). To stay safe we convert any
    // straight/curly apostrophes to the typographic apostrophe (U+2019),
    // and strip raw double quotes. Roboto-Bold renders ’ correctly.
    return String(text)
        .replace(/['\u2018\u2019\u02BC\u02B9]/g, '\u2019')
        .replace(/["\u201C\u201D]/g, '')
        .replace(/\\/g, '\\\\')
        .replace(/:/g, '\\:')
        .replace(/%/g, '\\%')
        .replace(/,/g, '\\,');
}

/**
 * Build drawtext filter chain for one slide segment.
 *
 * @param {Array} chunkTimings   output of buildChunkTimings()
 * @param {Object} opts
 *   fontPath      - escaped path to .ttf
 *   videoWidth    - px
 *   videoHeight   - px
 *   timeOffset    - seconds to ADD to chunk times (slide start in group)
 *   positionY     - expression for y; default lower-third
 *   fontSize      - base size; auto-scales to resolution
 *   accentColor   - hex-like "yellow" / "#FFEB3B"
 * @returns {string[]} array of drawtext filter strings
 */
function buildDrawtextFilters(chunkTimings, opts = {}) {
    const {
        fontPath,
        videoWidth = 1080,
        videoHeight = 1920,
        timeOffset = 0,
        positionY = null,
        fontSize = null,
        accentColor = 'yellow',
        baseColor = 'white'
    } = opts;

    if (!chunkTimings || !chunkTimings.length) return [];

    // Auto-scale font to resolution — feels "Submagic-like" at ~7% of width
    const fs = fontSize || Math.round(videoWidth * 0.075);
    // Position caption in lower third — leaves room for branding at bottom
    const y = positionY || `h*0.62`;

    const filters = [];

    chunkTimings.forEach((c, idx) => {
        const st = (c.startTime + timeOffset).toFixed(3);
        const en = (c.endTime   + timeOffset).toFixed(3);
        const safeText = sanitizeDrawtext(c.text.toUpperCase());
        
        // Dynamic Font Scaling: shrink if text is long despite chunking
        let currentFs = fs;
        if (c.text.length > 20) currentFs = Math.round(fs * 0.75);
        else if (c.text.length > 15) currentFs = Math.round(fs * 0.85);

        // Base chunk: all words in white, boxed, with heavy stroke
        filters.push([
            `drawtext=fontfile='${fontPath}'`,
            `text='${safeText}'`,
            `fontcolor=${baseColor}`,
            `fontsize=${currentFs}`,
            `borderw=${Math.max(4, Math.round(currentFs * 0.08))}`,
            `bordercolor=black`,
            `shadowcolor=black@0.6`,
            `shadowx=3:shadowy=4`,
            `box=1`,
            `boxcolor=black@0.55`,
            `boxborderw=${Math.round(currentFs * 0.25)}`,
            `x=(w-text_w)/2`, // Centered
            `y=${y}`,
            `fix_bounds=true`, // Prevent going off-screen
            `enable='between(t\\,${st}\\,${en})'`
        ].join(':'));

        // Accent overlay: KEY word drawn in yellow, positioned to overlay the base.
        // We stack it on top in the same enable window — simpler than partial highlights
        // and still looks "pro".
        if (c.words && c.words.length > 1) {
            const keyWord = sanitizeDrawtext(c.words[c.keyIndex].toUpperCase());
            // Place the keyword inline by offsetting — approximation using a fresh drawtext
            // that shows ONLY the keyword in accent, slightly scaled up for pop.
            const accentFs = Math.round(fs * 1.12);
            filters.push([
                `drawtext=fontfile='${fontPath}'`,
                `text='${keyWord}'`,
                `fontcolor=${accentColor}`,
                `fontsize=${accentFs}`,
                `borderw=${Math.max(5, Math.round(accentFs * 0.09))}`,
                `bordercolor=black`,
                `shadowcolor=black@0.7`,
                `shadowx=3:shadowy=5`,
                `x=(w-text_w)/2`,
                // Place accent slightly ABOVE the base chunk for a stacked, emphasized look
                `y=${y}-${Math.round(fs * 1.3)}`,
                `enable='between(t\\,${st}\\,${en})'`
            ].join(':'));
        }
    });

    return filters;
}

/**
 * Convenience: generate drawtext chain directly from narration text + audio duration.
 */
function buildCaptionFiltersFromText(text, audioDuration, opts = {}) {
    const timings = buildChunkTimings(text, audioDuration, opts.chunkSize || DEFAULT_CHUNK_SIZE);
    return buildDrawtextFilters(timings, opts);
}

module.exports = {
    tokenize,
    chunkWords,
    buildChunkTimings,
    buildDrawtextFilters,
    buildCaptionFiltersFromText,
    sanitizeDrawtext
};
