/**
 * Edge TTS Service — Microsoft Edge Read Aloud (FREE, no API key).
 *
 * Natural Indonesian voices jauh lebih "manusiawi" daripada Google Translate TTS,
 * sehingga video hasil pipeline lebih aman dari flag "konten repetitif /
 * robot voice" di YouTube monetization review.
 *
 * Voices (id-ID):
 *   - id-ID-ArdiNeural   (pria, hangat)
 *   - id-ID-GadisNeural  (wanita, ceria)
 *
 * Dependency: `msedge-tts` (sudah di package.json)
 */

const fs = require('fs');
const path = require('path');

// Lazy-load supaya module tidak crash di env tanpa dep (test harness dsb)
let MsEdgeTTS, OUTPUT_FORMAT;
try {
    ({ MsEdgeTTS, OUTPUT_FORMAT } = require('msedge-tts'));
} catch (_) { /* noop */ }

const EDGE_VOICES = {
    'edge-id-ardi':  { name: '🇮🇩 Ardi (Pria, hangat)',      voice: 'id-ID-ArdiNeural',  type: 'male'   },
    'edge-id-gadis': { name: '🇮🇩 Gadis (Wanita, ceria)',    voice: 'id-ID-GadisNeural', type: 'female' }
};

const DEFAULT_EDGE_VOICE = 'edge-id-gadis';

function isEdgeVoice(voiceOption) {
    return Boolean(EDGE_VOICES[voiceOption]);
}

function getEdgeVoices() {
    return Object.fromEntries(
        Object.entries(EDGE_VOICES).map(([k, v]) => [k, { id: k, name: v.name, type: v.type }])
    );
}

/**
 * Pick a random Edge voice id — dipakai untuk rotasi otomatis supaya
 * video hasil batch tidak terdengar identik.
 */
function pickRandomEdgeVoice() {
    const keys = Object.keys(EDGE_VOICES);
    return keys[Math.floor(Math.random() * keys.length)];
}

/**
 * Generate MP3 audio via Edge TTS.
 * @param {string} text
 * @param {string} voiceOption   key from EDGE_VOICES (e.g. 'edge-id-gadis')
 * @param {number} speed         0.75–1.5 (mapped ke rate %)
 * @returns {Promise<Buffer>}    audio buffer (MP3)
 */
async function generateEdgeAudio(text, voiceOption = DEFAULT_EDGE_VOICE, speed = 1.0) {
    if (!MsEdgeTTS) {
        throw new Error('msedge-tts belum terinstall. Jalankan: npm install msedge-tts');
    }
    const trimmed = (text || '').trim();
    if (!trimmed) throw new Error('Narasi text tidak boleh kosong');

    const cfg = EDGE_VOICES[voiceOption] || EDGE_VOICES[DEFAULT_EDGE_VOICE];
    const ratePct = Math.round((speed - 1.0) * 100);
    const rateStr = (ratePct >= 0 ? '+' : '') + ratePct + '%';

    const tts = new MsEdgeTTS();
    await tts.setMetadata(cfg.voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

    // msedge-tts exposes toStream which returns {audioStream}
    const { audioStream } = tts.toStream(trimmed, { rate: rateStr });

    const chunks = [];
    return await new Promise((resolve, reject) => {
        audioStream.on('data', c => chunks.push(c));
        audioStream.on('end',  () => resolve(Buffer.concat(chunks)));
        audioStream.on('close',() => resolve(Buffer.concat(chunks)));
        audioStream.on('error', reject);
    });
}

/**
 * Convenience: generate + save to disk.
 */
async function generateAndSaveEdge(text, destPath, voiceOption, speed) {
    const buf = await generateEdgeAudio(text, voiceOption, speed);
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(destPath, buf);
    return destPath;
}

module.exports = {
    EDGE_VOICES,
    DEFAULT_EDGE_VOICE,
    isEdgeVoice,
    getEdgeVoices,
    pickRandomEdgeVoice,
    generateEdgeAudio,
    generateAndSaveEdge
};
