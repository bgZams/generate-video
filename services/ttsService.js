/**
 * Text-to-Speech Audio Generation Service
 * Menggunakan OpenAI TTS API untuk generate narasi audio
 * dengan berbagai pilihan suara yang lembut
 */

const axios = require('axios');
const path = require('path');
const fs = require('fs');

const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

const googleTTS = require('google-tts-api');

// Voice options dengan deskripsi
const VOICE_OPTIONS = {
    'google-id': {
        name: '🇮🇩 Native Indonesian (Google)',
        description: 'Suara asli Indonesia (logat pas, agak robotik)',
        type: 'female',
        provider: 'google'
    },
    shimmer: {
        name: '🎀 Shimmer (Sangat Lembut - Wanita)',
        description: 'Suara wanita yang lembut dan menyenangkan',
        type: 'female',
        provider: 'openai'
    },
    nova: {
        name: '✨ Nova (Cerah & Lembut - Wanita)',
        description: 'Suara wanita yang cerah dan energik',
        type: 'female',
        provider: 'openai'
    },
    alloy: {
        name: '🎤 Alloy (Netral & Jelas - Wanita)',
        description: 'Suara wanita yang balanced dan natural',
        type: 'female',
        provider: 'openai'
    },
    fable: {
        name: '🎧 Fable (Hangat - Pria)',
        description: 'Suara pria yang hangat dan storytelling',
        type: 'male',
        provider: 'openai'
    },
    onyx: {
        name: '🎺 Onyx (Berwibawa - Pria)',
        description: 'Suara pria yang dalam dan professional',
        type: 'male',
        provider: 'openai'
    }
};

// Default voice (paling natural logatnya)
const DEFAULT_VOICE = 'google-id';

// Speed options
const SPEED_OPTIONS = {
    slow: 0.75,
    normal: 0.9,
    fast: 1.1,
    faster: 1.25
};

const DEFAULT_SPEED = 0.9;

/**
 * Generate audio dari narasi text
 * @param {string} narrationText - Text narasi yang akan diubah ke audio
 * @param {string} voiceOption - Pilihan suara (shimmer, nova, alloy, fable, onyx)
 * @param {number} speed - Kecepatan audio (0.75, 1.0, 1.25, 1.5)
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Buffer>} Audio file buffer
 */
async function generateNarrationAudio(narrationText, voiceOption = DEFAULT_VOICE, speed = DEFAULT_SPEED, apiKey) {
    // Validate inputs
    const trimmedText = (narrationText || '').trim();
    if (!trimmedText) {
        throw new Error('Narasi text tidak boleh kosong');
    }

    if (!apiKey || !apiKey.trim()) {
        throw new Error('OpenAI API key diperlukan');
    }

    // Validate voice option
    if (!VOICE_OPTIONS[voiceOption]) {
        throw new Error(`Suara "${voiceOption}" tidak valid. Pilihan: ${Object.keys(VOICE_OPTIONS).join(', ')}`);
    }

    // Validate speed
    if (!SPEED_OPTIONS[speed] && typeof speed !== 'number') {
        throw new Error(`Kecepatan "${speed}" tidak valid. Pilihan: slow, normal, fast, faster atau angka 0.75-1.5`);
    }

    const voiceConfig = VOICE_OPTIONS[voiceOption];
    const finalSpeed = typeof speed === 'number' ? speed : SPEED_OPTIONS[speed];

    console.log(`📢 Generating audio (${voiceConfig.provider}):`);
    console.log(`  Text: "${trimmedText.substring(0, 50)}${trimmedText.length > 50 ? '...' : ''}"`);
    console.log(`  Voice: ${voiceConfig.name}`);
    console.log(`  Speed: ${finalSpeed}x`);

    try {
        if (voiceConfig.provider === 'google') {
            // Google TTS logic (max 200 chars per chunk)
            if (trimmedText.length <= 200) {
                const url = googleTTS.getAudioUrl(trimmedText, {
                    lang: 'id',
                    slow: finalSpeed < 1.0,
                    host: 'https://translate.google.com',
                });
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                console.log(`  ✅ Google Audio generated (${response.data.length} bytes)`);
                return response.data;
            } else {
                // Split long text
                const chunks = googleTTS.getAllAudioUrls(trimmedText, {
                    lang: 'id',
                    slow: finalSpeed < 1.0,
                    host: 'https://translate.google.com',
                });
                const buffers = [];
                for (const chunk of chunks) {
                    const res = await axios.get(chunk.url, { responseType: 'arraybuffer' });
                    buffers.push(Buffer.from(res.data));
                }
                const combined = Buffer.concat(buffers);
                console.log(`  ✅ Google Combined Audio generated (${combined.length} bytes)`);
                return combined;
            }
        } else {
            // OpenAI original logic
            const response = await axios.post(
                OPENAI_TTS_URL,
                {
                    model: 'tts-1-hd',
                    voice: voiceOption,
                    input: trimmedText,
                    speed: finalSpeed
                },
                {
                    headers: {
                        'Authorization': `Bearer ${apiKey.trim()}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000,
                    responseType: 'arraybuffer'
                }
            );

            console.log(`  ✅ OpenAI Audio generated (${response.data.length} bytes)`);
            return response.data;
        }
    } catch (error) {
        const apiError = error.response?.data?.error?.message;
        const message = apiError || error.message;
        throw new Error(`Gagal generate audio (${voiceConfig.provider}): ${message}`);
    }
}

/**
 * Save audio buffer ke file MP3
 * @param {Buffer} audioBuffer - Audio data
 * @param {string} filename - Nama file (tanpa extension)
 * @param {string} outputDir - Directory untuk save file
 * @returns {string} Path ke file yang disave
 */
async function saveAudioFile(audioBuffer, filename, outputDir = path.join(__dirname, '..', 'output')) {
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const filepath = path.join(outputDir, `${filename}.mp3`);
    fs.writeFileSync(filepath, audioBuffer);

    console.log(`💾 Audio saved: ${filepath}`);
    return filepath;
}

/**
 * Get semua voice options yang tersedia
 * @returns {Object} Voice options
 */
function getVoiceOptions() {
    const options = {};
    for (const [key, value] of Object.entries(VOICE_OPTIONS)) {
        options[key] = {
            id: key,
            name: value.name,
            description: value.description,
            type: value.type
        };
    }
    return options;
}

/**
 * Get semua speed options
 * @returns {Object} Speed options
 */
function getSpeedOptions() {
    return {
        slow: { label: '🐢 Lambat', value: 0.75 },
        normal: { label: '▶️ Normal', value: 1.0 },
        fast: { label: '⏩ Cepat', value: 1.25 },
        faster: { label: '⏭️ Lebih Cepat', value: 1.5 }
    };
}

/**
 * Validate voice option
 * @param {string} voice - Voice option
 * @returns {boolean}
 */
function isValidVoice(voice) {
    return voice in VOICE_OPTIONS;
}

/**
 * Validate speed option
 * @param {number|string} speed - Speed value
 * @returns {boolean}
 */
function isValidSpeed(speed) {
    if (typeof speed === 'string') {
        return speed in SPEED_OPTIONS;
    }
    if (typeof speed === 'number') {
        return speed >= 0.75 && speed <= 1.5;
    }
    return false;
}

module.exports = {
    generateNarrationAudio,
    saveAudioFile,
    getVoiceOptions,
    getSpeedOptions,
    isValidVoice,
    isValidSpeed,
    VOICE_OPTIONS,
    SPEED_OPTIONS,
    DEFAULT_VOICE,
    DEFAULT_SPEED
};
