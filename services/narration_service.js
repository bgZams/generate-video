const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const dataDir = path.join(__dirname, '..', 'data');
const historyFile = path.join(dataDir, 'title_history.json');
const legacyUsedTitlesFile = path.join(__dirname, '..', 'used_titles.txt');
const DEFAULT_MODEL = 'gemini-flash-latest';

function ensureStorage() {
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }

    if (!fs.existsSync(historyFile)) {
        const seedEntries = fs.existsSync(legacyUsedTitlesFile)
            ? fs.readFileSync(legacyUsedTitlesFile, 'utf-8')
                .split(/\r?\n/)
                .map(title => title.trim())
                .filter(Boolean)
                .map(title => ({
                    id: crypto.randomUUID(),
                    title,
                    titleKey: normalizeTitle(title),
                    summary: '',
                    narrationSegments: [],
                    topic: '',
                    slideCount: 0,
                    createdAt: new Date().toISOString(),
                    lastGeneratedAt: null,
                    lastUsedAt: new Date().toISOString(),
                    useCount: 1,
                    model: '',
                    source: 'legacy'
                }))
            : [];

        fs.writeFileSync(historyFile, JSON.stringify(seedEntries, null, 2));
    }
}

function normalizeTitle(title = '') {
    return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

function readHistory() {
    ensureStorage();

    try {
        const raw = fs.readFileSync(historyFile, 'utf-8').trim();
        if (!raw) {
            return [];
        }

        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn('Failed to read title history, resetting file.', error.message);
        fs.writeFileSync(historyFile, '[]');
        return [];
    }
}

function writeHistory(history) {
    ensureStorage();
    fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
}

function sortHistory(history) {
    return [...history].sort((a, b) => {
        const aTime = new Date(a.lastUsedAt || a.lastGeneratedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.lastUsedAt || b.lastGeneratedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
    });
}

function formatHistoryEntry(entry) {
    return {
        id: entry.id,
        title: entry.title,
        summary: entry.summary || '',
        narrationSegments: Array.isArray(entry.narrationSegments) ? entry.narrationSegments : [],
        topic: entry.topic || '',
        slideCount: entry.slideCount || 0,
        createdAt: entry.createdAt || null,
        lastGeneratedAt: entry.lastGeneratedAt || null,
        lastUsedAt: entry.lastUsedAt || null,
        useCount: entry.useCount || 0,
        model: entry.model || '',
        isUsed: (entry.useCount || 0) > 0
    };
}

function readUsedTitles() {
    return new Set(
        readHistory()
            .filter(entry => (entry.useCount || 0) > 0)
            .map(entry => entry.title)
    );
}

function getTitleHistory() {
    return sortHistory(readHistory()).map(formatHistoryEntry);
}

function upsertGeneratedIdea(idea, metadata = {}) {
    const history = readHistory();
    const titleKey = normalizeTitle(idea.title);
    const now = new Date().toISOString();
    const existingIndex = history.findIndex(entry => entry.titleKey === titleKey);

    const nextEntry = {
        id: existingIndex >= 0 ? history[existingIndex].id : crypto.randomUUID(),
        title: idea.title.trim(),
        titleKey,
        summary: idea.summary || '',
        narrationSegments: Array.isArray(idea.narrationSegments) ? idea.narrationSegments : [],
        topic: metadata.topic || '',
        slideCount: metadata.slideCount || 0,
        createdAt: existingIndex >= 0 ? history[existingIndex].createdAt : now,
        lastGeneratedAt: now,
        lastUsedAt: existingIndex >= 0 ? (history[existingIndex].lastUsedAt || null) : null,
        useCount: existingIndex >= 0 ? (history[existingIndex].useCount || 0) : 0,
        model: metadata.model || DEFAULT_MODEL,
        source: 'gemini'
    };

    if (existingIndex >= 0) {
        history[existingIndex] = { ...history[existingIndex], ...nextEntry };
    } else {
        history.push(nextEntry);
    }

    writeHistory(history);
    return formatHistoryEntry(nextEntry);
}

function saveUsedTitle(title, payload = {}) {
    const titleKey = normalizeTitle(title);
    if (!titleKey) {
        return null;
    }

    const history = readHistory();
    const now = new Date().toISOString();
    const existingIndex = history.findIndex(entry =>
        (payload.ideaId && entry.id === payload.ideaId) || entry.titleKey === titleKey
    );

    const existing = existingIndex >= 0 ? history[existingIndex] : null;
    const updatedEntry = {
        id: existing ? existing.id : (payload.ideaId || crypto.randomUUID()),
        title: existing ? existing.title : title.trim(),
        titleKey,
        summary: existing ? existing.summary : (payload.summary || ''),
        narrationSegments: existing ? existing.narrationSegments : (payload.narrationSegments || []),
        topic: existing ? existing.topic : (payload.topic || ''),
        slideCount: existing ? existing.slideCount : ((payload.narrationSegments || []).length || 0),
        createdAt: existing ? existing.createdAt : now,
        lastGeneratedAt: existing ? existing.lastGeneratedAt : now,
        lastUsedAt: now,
        useCount: (existing?.useCount || 0) + 1,
        model: existing ? existing.model : (payload.model || ''),
        source: existing ? existing.source : 'manual'
    };

    if (existingIndex >= 0) {
        history[existingIndex] = { ...existing, ...updatedEntry };
    } else {
        history.push(updatedEntry);
    }

    writeHistory(history);
    return formatHistoryEntry(updatedEntry);
}

// ===== VIDEO MODE PRESETS =====
/**
 * Preset konfigurasi per mode video.
 * Mengatur slideCount dan maxDurationSec secara konsisten di frontend dan backend.
 */
const VIDEO_MODE_PRESETS = {
    short: {
        label: 'YouTube Shorts / Reels (< 60 detik)',
        slideCount: 9,
        maxDurationSec: 58,
        resolutionDefault: '9:16',
        sentencesPerSlide: '1–2 kalimat pendek (max 15 kata per kalimat)'
    },
    medium: {
        label: 'Video Standar (2–5 menit)',
        slideCount: 25,
        maxDurationSec: 300,
        resolutionDefault: '16:9',
        sentencesPerSlide: '3–5 kalimat yang informatif dan mengalir (25–50 kata per slide)'
    },
    long: {
        label: 'Video Panjang (5–15 menit)',
        slideCount: 50,
        maxDurationSec: 900,
        resolutionDefault: '16:9',
        sentencesPerSlide: '5–8 kalimat mendalam dengan storytelling dan bukti/contoh (50–100 kata per slide)'
    }
};

// --- Archetype variation (anti "templated content" flag) -------------------
// Dipilih RANDOM tiap request supaya struktur narasi tidak identik antar
// video: hook, gaya isi, dan CTA rotasi — mengurangi risiko kena flag
// "mass-produced content" saat review monetisasi YouTube.
const HOOK_ARCHETYPES = [
    'Mulai dengan NEGATIVE HOOK: Bongkar kesalahan umum atau mitos yang dipercayai penonton ("Berhenti lakukan X jika tidak ingin Y...").',
    'Mulai dengan CURIOSITY GAP: Sebutkan hasil yang luar biasa tanpa menyebutkan caranya di awal ("Inilah alasan kenapa X bisa mencapai Y dalam waktu singkat...").',
    'Mulai dengan BOLD STATEMENT: Pernyataan kontroversial atau fakta ekstrem yang menantang logika umum.',
    'Mulai dengan EMOTIONAL HOOK: Langsung tembak titik sakit penonton ("Pernah merasa X? Kamu tidak sendirian, ini alasannya...").',
    'Mulai dengan SECRET/HIDDEN INFO: Seolah-olah membocorkan rahasia ("Hampir tidak ada yang tahu, tapi X sebenarnya adalah...").'
];

const CONTENT_STYLES = [
    'Bicara dengan JIWA: Gunakan kata-kata yang menyentuh emosi terdalam penonton. Hindari narasi robotik.',
    'Teknik "The Authority Voice": Narasikan dengan nada yang sangat meyakinkan, berikan bukti logis yang tidak terbantahkan.',
    'Gaya Storytelling "Plot Twist": Mulai dengan premis yang biasa saja, lalu jatuhkan fakta mengejutkan di tengah video.',
    'Narrative Fast-Paced: Berikan 1 rahasia baru setiap 5 detik agar penonton tidak punya alasan untuk scroll.',
    'Gaya Spiritual/Deep: Khusus tema motivasi, buat penonton merasa sedang berbicara dengan hati kecil mereka sendiri.'
];

const CTA_ARCHETYPES = [
    '"Subscribe jika kamu ingin hidupmu berubah 1% setiap hari."',
    '"Klik like jika pesan ini adalah jawaban doa-doamu hari ini."',
    '"Follow untuk bergabung dalam perjalanan hijrah terbaikmu."',
    '"Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."',
    '"Simpan video ini, tonton saat kamu sedang merasa paling lemah."'
];

function pickOne(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// --- SHORT FORM PROMPT (< 60 detik) ---
function buildPrompt({ topic, slideCount, count, usedTitles }) {
    const safeTopic = topic?.trim() || 'Buat tema video pendek yang menarik untuk konten Indonesia.';
    const exclusions = usedTitles.length
        ? `Jangan ulangi atau mirip dengan judul berikut: ${usedTitles.join(' | ')}.`
        : 'Belum ada judul terpakai sebelumnya.';

    const hookStyle    = pickOne(HOOK_ARCHETYPES);
    const contentStyle = pickOne(CONTENT_STYLES);
    const ctaStyle     = pickOne(CTA_ARCHETYPES);

    return [
        `Tema utama: ${safeTopic}`,
        `Buat ${count} ide judul video YouTube SHORTS dalam bahasa Indonesia yang sangat viral dan meyakinkan.`,
        '',
        'STRUKTUR NARASI WAJIB (Format High-Retention SHORT VIDEO):',
        `- Total ${slideCount} potongan narasi.`,
        `- Slide 1 (HOOK): ${hookStyle} Harus sangat kuat, durasi < 3 detik. Gunakan kata "Stop", "Rahasia", "Bahaya", atau "Akhirnya".`,
        `- Slide 2 sampai ${slideCount - 1} (BODY): ${contentStyle} Gunakan logika yang masuk akal, beri bukti/analogi singkat agar penonton YAKIN.`,
        `- Slide ${slideCount} (CTA): ${ctaStyle} Singkat dan tegas.`,
        '',
        'PRINSIP NARASI SHORT FORM (PENTING):',
        '- PANJANG PER SLIDE: MAKSIMAL 1-2 kalimat pendek per slide. Max 15 kata per kalimat.',
        '- TONE: Otoritatif, percaya diri, dan empati. Bicara seperti seorang mentor atau ahli yang peduli.',
        '- DIKSI: Gunakan kata kerja aktif. Hindari "mungkin", "sepertinya". Ganti dengan "pasti", "terbukti", "faktanya".',
        '- RITME: Kalimat pendek-pendek. Setiap slide = 1 poin saja.',
        '',
        `Judul harus sangat clickbait tapi relevan (9.5/10 viral score), 30-70 karakter.`,
        `Summary singkat yang menjelaskan kenapa video ini bakal FYP.`,
        '',
        'RETURN FORMAT (JSON ONLY):',
        '{ "ideas": [ { "title": "string", "summary": "string", "narrationSegments": ["string"] } ] }',
        '',
        exclusions
    ].join('\n');
}

// --- MEDIUM FORM PROMPT (2–5 menit) ---
function buildMediumFormPrompt({ topic, slideCount, count, usedTitles }) {
    const safeTopic = topic?.trim() || 'Buat tema video yang menarik dan informatif untuk konten Indonesia.';
    const exclusions = usedTitles.length
        ? `Jangan ulangi atau mirip dengan judul berikut: ${usedTitles.join(' | ')}.`
        : 'Belum ada judul terpakai sebelumnya.';

    const hookStyle    = pickOne(HOOK_ARCHETYPES);
    const contentStyle = pickOne(CONTENT_STYLES);

    return [
        `Tema utama: ${safeTopic}`,
        `Buat ${count} ide video YouTube berdurasi 2-5 MENIT dalam bahasa Indonesia yang informatif, berkualitas tinggi, dan layak ditonton penuh.`,
        '',
        'STRUKTUR NARASI WAJIB (Format Medium-Form Video):',
        `- Total ${slideCount} segmen narasi yang mengalir seperti presentasi berkualitas tinggi.`,
        `- Segmen 1-2 (INTRO & HOOK): ${hookStyle} Kenalkan topik secara engaging. 3-4 kalimat.`,
        `- Segmen 3 sampai ${slideCount - 3} (ISI UTAMA): ${contentStyle}`,
        '  * Setiap segmen membahas SATU SUB-TOPIK secara mendalam.',
        '  * Gunakan transisi antar segmen yang smooth seperti "Selain itu...", "Yang lebih menarik lagi...", "Fakta berikutnya...".',
        '  * Sertakan data, contoh nyata, atau analogi yang mudah dipahami.',
        '  * Panjang per segmen: 3-5 kalimat (30-50 kata).',
        `- Segmen ${slideCount - 2} sampai ${slideCount} (PENUTUP & CTA):`,
        '  * Rangkum poin-poin penting dengan elegan.',
        '  * Ajukan pertanyaan rhetoris yang mendorong komentar.',
        '  * CTA yang natural dan tidak memaksa.',
        '',
        'PRINSIP NARASI MEDIUM FORM (PENTING):',
        '- KEDALAMAN: Setiap segmen harus memberikan VALUE nyata — fakta unik, wawasan baru, atau perspektif yang belum pernah penonton dengar.',
        '- FLOW: Narasi harus terasa seperti satu kesatuan cerita yang mengalir, bukan daftar poin terpisah.',
        '- BAHASA: Natural, conversational, tapi tetap informatif. Seperti mendengar podcast berkualitas tinggi.',
        '- PANJANG PER SEGMEN: 30-50 kata, 3-5 kalimat informatif per segmen.',
        '- VARIASI: Ganti ritme narasi — kadang cepat dan punchy, kadang lambat dan reflektif.',
        '',
        `Judul harus profesional, informatif, dan click-worthy (8/10 viral score), 40-80 karakter.`,
        `Summary: jelaskan value utama video ini bagi penonton.`,
        '',
        'RETURN FORMAT (JSON ONLY):',
        '{ "ideas": [ { "title": "string", "summary": "string", "narrationSegments": ["string"] } ] }',
        '',
        exclusions
    ].join('\n');
}

// --- LONG FORM PROMPT (5–15 menit) ---
function buildLongFormPrompt({ topic, slideCount, count, usedTitles }) {
    const safeTopic = topic?.trim() || 'Buat tema video panjang yang edukatif dan bernilai tinggi untuk konten Indonesia.';
    const exclusions = usedTitles.length
        ? `Jangan ulangi atau mirip dengan judul berikut: ${usedTitles.join(' | ')}.`
        : 'Belum ada judul terpakai sebelumnya.';

    const contentStyle = pickOne(CONTENT_STYLES);

    return [
        `Tema utama: ${safeTopic}`,
        `Buat ${count} ide video YouTube berdurasi 5-15 MENIT (long-form) dalam bahasa Indonesia.`,
        'Video ini harus terasa seperti DOKUMENTER atau PODCAST berkualitas tinggi yang layak ditonton dari awal hingga akhir.',
        '',
        'STRUKTUR NARASI WAJIB (Format Long-Form / Dokumenter):',
        `- Total ${slideCount} segmen narasi yang membentuk perjalanan naratif yang kohesif.`,
        '',
        '== BABAK 1 — PEMBUKA (Segmen 1-5):',
        '  * Segmen 1: TEASER — Mulai dengan fakta atau pertanyaan paling mengejutkan/menarik dari seluruh video. 4-5 kalimat.',
        '  * Segmen 2-3: KONTEKS — Berikan latar belakang topik. Kenapa ini penting? Apa yang kebanyakan orang salah pahami? 5-7 kalimat per segmen.',
        '  * Segmen 4-5: JEMBATAN — Transisi ke isi utama dengan "Dan itulah mengapa kita perlu membahas..." 4-5 kalimat.',
        '',
        '== BABAK 2 — ISI UTAMA (Segmen 6 hingga ' + (slideCount - 6) + '):',
        `  * ${contentStyle}`,
        '  * Bagi isi menjadi 3-5 SUB-TOPIK besar, masing-masing 3-5 segmen.',
        '  * Setiap sub-topik punya PEMBUKA (perkenalan sub-topik), ISI (fakta/data/cerita), dan PENUTUP MINI (insight/rangkuman).',
        '  * Panjang per segmen: 50-100 kata, 5-8 kalimat yang kaya informasi.',
        '  * Gunakan teknik storytelling: mulai dengan masalah, bangun ketegangan, berikan resolusi.',
        '  * Sisipkan "Did you know?", "Fun fact:", atau "Bayangkan jika..." untuk menjaga engagement.',
        '',
        `== BABAK 3 — PENUTUP (Segmen ${slideCount - 5} hingga ${slideCount}):`,
        '  * Rangkum perjalanan naratif secara elegan.',
        '  * Berikan insight atau perspektif baru yang membuat penonton berpikir.',
        '  * Akhiri dengan pertanyaan terbuka yang mendorong diskusi di komentar.',
        '  * CTA yang terasa natural dan tidak memaksa.',
        '',
        'PRINSIP NARASI LONG FORM (SANGAT PENTING):',
        '- KEDALAMAN PREMIUM: Setiap segmen HARUS memberikan informasi yang bisa penonton bagikan kepada teman mereka.',
        '- NARASI SEPERTI DOKUMENTER: Tone serius namun accessible, seperti menonton National Geographic atau film dokumenter Netflix.',
        '- KONSISTENSI: Jaga benang merah naratif dari awal hingga akhir. Setiap segmen harus terkoneksi.',
        '- BAHASA: Formal tapi tidak kaku. Gunakan metafora dan analogi yang kuat.',
        '- PANJANG PER SEGMEN: 50-100 kata. Jangan ringkas — berikan penjelasan yang memuaskan.',
        '- FAKTA & DATA: Sertakan angka, tahun, nama tempat, atau tokoh untuk meningkatkan kredibilitas.',
        '',
        `Judul harus profesional dan menjanjikan value yang tinggi (contoh: "Kisah Lengkap...", "Rahasia di Balik...", "Mengapa Dunia...").`,
        `Summary: jelaskan dengan detail apa yang akan penonton pelajari dari video ini.`,
        '',
        'RETURN FORMAT (JSON ONLY):',
        '{ "ideas": [ { "title": "string", "summary": "string", "narrationSegments": ["string"] } ] }',
        '',
        exclusions
    ].join('\n');
}

// Pilih prompt builder berdasarkan videoMode
function selectPromptBuilder(videoMode) {
    if (videoMode === 'long') return buildLongFormPrompt;
    if (videoMode === 'medium') return buildMediumFormPrompt;
    return buildPrompt; // default: short
}

async function generateIdeas(apiKey, options = {}) {
    const trimmedApiKey = (apiKey || '').trim();
    if (!trimmedApiKey) {
        throw new Error('API key Gemini wajib diisi.');
    }

    const videoMode = options.videoMode || 'short';
    const preset = VIDEO_MODE_PRESETS[videoMode] || VIDEO_MODE_PRESETS.short;
    const slideCount = Math.max(1, Math.min(60, Number(options.slideCount) || preset.slideCount));
    // Long-form dengan 50 slide butuh output token sangat besar — kurangi default count agar tidak truncated
    const defaultCount = videoMode === 'long' ? 2 : videoMode === 'medium' ? 3 : 5;
    const count = Math.max(1, Math.min(10, Number(options.count) || defaultCount));
    const modelName = (options.model || DEFAULT_MODEL).replace('gpt-4o-mini', 'gemini-flash-latest').trim();
    console.log(`DEBUG - Using Gemini Model: "${modelName}" | videoMode: ${videoMode} | slideCount: ${slideCount} | count: ${count}`);
    const usedTitles = Array.from(readUsedTitles());
    const usedTitleKeys = new Set(usedTitles.map(normalizeTitle));
    const promptBuilder = selectPromptBuilder(videoMode);
    const promptText = promptBuilder({
        topic: options.topic,
        slideCount,
        count,
        usedTitles
    });

    // Long-form narasi butuh lebih banyak token dari AI
    const systemInstruction = videoMode === 'long'
        ? 'Kamu adalah penulis skrip video dokumenter profesional Indonesia. Tulis narasi yang mendalam, panjang, dan kaya informasi. Return JSON only.'
        : videoMode === 'medium'
        ? 'Kamu adalah host podcast Indonesia yang informatif. Tulis narasi yang mengalir dan bernilai tinggi. Return JSON only.'
        : 'Kamu membuat ide video pendek unik dalam bahasa Indonesia. Kamu harus mengembalikan data dalam format JSON saja.';

    try {
        const genAI = new GoogleGenerativeAI(trimmedApiKey, { apiVersion: 'v1' });
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Skalakan maxOutputTokens berdasarkan mode video agar tidak truncated
        const maxOutputTokens = videoMode === 'long' ? 65536
            : videoMode === 'medium' ? 16384
            : 8192;

        const result = await model.generateContent({
            contents: [{ 
                role: 'user', 
                parts: [{ text: promptText + '\n\nRemember: ONLY return valid JSON. Make sure every narrationSegment is detailed and complete.' }] 
            }],
            generationConfig: {
                responseMimeType: 'application/json',
                maxOutputTokens,
            },
            systemInstruction,
        });

        const response = await result.response;
        const text = response.text();
        
        let parsed;
        try {
            parsed = tryParseJsonResponse(text);
        } catch (error) {
            console.error('Failed to parse Gemini JSON (length=' + text.length + '):', text.substring(0, 500) + '...');
            // Retry sekali dengan count=1 agar output lebih kecil
            if (count > 1) {
                console.log('Retrying with count=1 to reduce output size...');
                return generateIdeas(apiKey, { ...options, count: 1 });
            }
            throw new Error('Gagal membaca respons JSON dari Gemini. Respons terpotong atau tidak valid.');
        }

        const rawIdeas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
        const uniqueIdeas = [];
        const seen = new Set();

        for (const idea of rawIdeas) {
            const title = (idea?.title || '').trim();
            const titleKey = normalizeTitle(title);
            const narrationSegments = Array.isArray(idea?.narrationSegments)
                ? idea.narrationSegments.map(item => String(item || '').trim()).filter(Boolean)
                : [];

            if (!title || seen.has(titleKey) || usedTitleKeys.has(titleKey) || narrationSegments.length === 0) {
                continue;
            }

            while (narrationSegments.length < slideCount) {
                narrationSegments.push('');
            }

            seen.add(titleKey);
            uniqueIdeas.push({
                title,
                summary: String(idea?.summary || '').trim(),
                narrationSegments: narrationSegments.slice(0, slideCount)
            });
        }

        if (!uniqueIdeas.length) {
            throw new Error('Tidak ada ide valid yang berhasil dibuat.');
        }

        const savedIdeas = uniqueIdeas.map(idea => upsertGeneratedIdea(idea, {
            topic: options.topic || '',
            slideCount,
            model: modelName,
            videoMode
        }));

        return {
            model: modelName,
            topic: options.topic || '',
            slideCount,
            videoMode,
            ideas: savedIdeas
        };

    } catch (error) {
        throw new Error(error.message || 'Gagal meminta ide ke Gemini.');
    }
}

async function generateNarration(title, apiKey, options = {}) {
    const result = await generateIdeas(apiKey, {
        topic: `Buat satu judul yang narasinya berpusat pada tema ini: ${title}`,
        slideCount: options.slideCount || 1,
        count: 1,
        model: options.model || DEFAULT_MODEL
    });

    return result.ideas[0];
}

// ===== Multi-provider support (OpenAI, Claude) =====

function finalizeIdeas(parsed, { slideCount, topic, modelName }) {
    const rawIdeas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
    const usedTitleKeys = new Set(Array.from(readUsedTitles()).map(normalizeTitle));
    const uniqueIdeas = [];
    const seen = new Set();

    for (const idea of rawIdeas) {
        const title = (idea?.title || '').trim();
        const titleKey = normalizeTitle(title);
        const narrationSegments = Array.isArray(idea?.narrationSegments)
            ? idea.narrationSegments.map(item => String(item || '').trim()).filter(Boolean)
            : [];

        if (!title || seen.has(titleKey) || usedTitleKeys.has(titleKey) || narrationSegments.length === 0) {
            continue;
        }

        while (narrationSegments.length < slideCount) {
            narrationSegments.push('');
        }

        seen.add(titleKey);
        uniqueIdeas.push({
            title,
            summary: String(idea?.summary || '').trim(),
            narrationSegments: narrationSegments.slice(0, slideCount)
        });
    }

    if (!uniqueIdeas.length) {
        throw new Error('Tidak ada ide valid yang berhasil dibuat.');
    }

    const savedIdeas = uniqueIdeas.map(idea => upsertGeneratedIdea(idea, {
        topic: topic || '',
        slideCount,
        model: modelName
    }));

    return {
        model: modelName,
        topic: topic || '',
        slideCount,
        ideas: savedIdeas
    };
}

/**
 * Coba parse JSON response, dengan recovery untuk JSON yang truncated atau
 * memiliki karakter ekstra (double closing brace, trailing text, dll).
 * Strategi:
 * 1. Parse langsung
 * 2. Ekstrak JSON object terbesar via regex
 * 2.5. Parse JSON object PERTAMA yang lengkap via brace-counting
 * 3. Repair JSON yang terpotong (truncated)
 */
function tryParseJsonResponse(text) {
    if (!text || !text.trim()) throw new Error('Respons kosong dari AI.');

    // Strategi 1: Parse langsung
    try {
        return JSON.parse(text);
    } catch (_) { /* lanjut ke strategi berikutnya */ }

    // Strategi 2: Ekstrak JSON object terbesar via regex (greedy)
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
        try {
            return JSON.parse(match[0]);
        } catch (_) { /* lanjut */ }
    }

    // Strategi 2.5: Temukan JSON object PERTAMA yang lengkap.
    // Gemini kadang mengembalikan "{ ... }\n}" (double closing brace).
    // Kita walk dari '{' pertama, hitung stack, dan potong saat stack = 0.
    const firstBrace = text.indexOf('{');
    if (firstBrace >= 0) {
        const extracted = extractFirstCompleteJsonObject(text, firstBrace);
        if (extracted) {
            try {
                return JSON.parse(extracted);
            } catch (_) { /* lanjut */ }
        }
    }

    // Strategi 3: Repair truncated JSON
    if (firstBrace === -1) throw new Error('Tidak ditemukan JSON object dalam respons.');

    let jsonStr = text.substring(firstBrace);
    const repaired = repairTruncatedJson(jsonStr);
    try {
        return JSON.parse(repaired);
    } catch (err) {
        throw new Error('Gagal membaca respons JSON dari AI (bahkan setelah repair).');
    }
}

/**
 * Walk dari posisi `start` (harus '{') dan kembalikan substring sampai
 * top-level object selesai (stack kembali ke 0 untuk pertama kalinya).
 * Menangani string literals dengan benar (skip brace di dalam string).
 */
function extractFirstCompleteJsonObject(text, start) {
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < text.length; i++) {
        const ch = text[i];
        if (escaped) { escaped = false; continue; }
        if (ch === '\\' && inString) { escaped = true; continue; }
        if (ch === '"') { inString = !inString; continue; }
        if (inString) continue;

        if (ch === '{') depth++;
        else if (ch === '}') {
            depth--;
            if (depth === 0) {
                // Object selesai — kembalikan dari start sampai sini (inklusif)
                return text.substring(start, i + 1);
            }
        }
    }
    return null; // Object tidak lengkap (truncated)
}

/**
 * Mencoba memperbaiki JSON yang terpotong (truncated) dengan:
 * - Menutup string yang terbuka
 * - Menutup array dan object yang terbuka
 */
function repairTruncatedJson(jsonStr) {
    let inString = false;
    let escaped = false;
    const stack = []; // track open { and [
    let lastValidIdx = 0;

    for (let i = 0; i < jsonStr.length; i++) {
        const ch = jsonStr[i];
        if (escaped) {
            escaped = false;
            continue;
        }
        if (ch === '\\' && inString) {
            escaped = true;
            continue;
        }
        if (ch === '"') {
            inString = !inString;
            lastValidIdx = i;
            continue;
        }
        if (inString) continue;

        if (ch === '{' || ch === '[') {
            stack.push(ch);
            lastValidIdx = i;
        } else if (ch === '}') {
            if (stack.length && stack[stack.length - 1] === '{') stack.pop();
            lastValidIdx = i;
        } else if (ch === ']') {
            if (stack.length && stack[stack.length - 1] === '[') stack.pop();
            lastValidIdx = i;
        }
    }

    // Jika stack kosong, JSON seharusnya lengkap — kembalikan apa adanya
    if (stack.length === 0) return jsonStr;

    // Potong di lastValidIdx + 1 untuk menghindari karakter corrupt di akhir
    let result = jsonStr.substring(0, lastValidIdx + 1);

    // Jika kita dalam string yang belum ditutup, tutup dulu
    if (inString) {
        result += '"';
    }

    // Tutup semua bracket/brace yang masih terbuka (dari terdalam ke terluar)
    while (stack.length) {
        const open = stack.pop();
        result += (open === '{') ? '}' : ']';
    }

    console.log(`JSON repair: closed ${stack.length} open brackets, result length: ${result.length}`);
    return result;
}

function extractJsonObject(text) {
    return tryParseJsonResponse(text);
}

async function generateIdeasOpenAI(apiKey, options = {}) {
    const trimmedApiKey = (apiKey || '').trim();
    if (!trimmedApiKey) {
        throw new Error('API key OpenAI wajib diisi.');
    }

    const videoMode = options.videoMode || 'short';
    const preset = VIDEO_MODE_PRESETS[videoMode] || VIDEO_MODE_PRESETS.short;
    const slideCount = Math.max(1, Math.min(60, Number(options.slideCount) || preset.slideCount));
    const defaultCount = videoMode === 'long' ? 2 : videoMode === 'medium' ? 3 : 5;
    const count = Math.max(1, Math.min(10, Number(options.count) || defaultCount));
    const modelName = (options.model || 'gpt-4o-mini').trim();
    const usedTitles = Array.from(readUsedTitles());
    const promptBuilder = selectPromptBuilder(videoMode);
    const promptText = promptBuilder({ topic: options.topic, slideCount, count, usedTitles });
    const maxTokens = videoMode === 'long' ? 16384 : videoMode === 'medium' ? 8192 : 4096;
    const systemContent = videoMode === 'long'
        ? 'Kamu adalah penulis skrip video dokumenter profesional Indonesia. Tulis narasi mendalam dan kaya informasi. Return JSON only.'
        : videoMode === 'medium'
        ? 'Kamu adalah host podcast Indonesia yang informatif dan engaging. Return JSON only.'
        : 'Kamu membuat ide video pendek unik dalam bahasa Indonesia. Return JSON only.';

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: modelName,
                max_tokens: maxTokens,
                response_format: { type: 'json_object' },
                messages: [
                    { role: 'system', content: systemContent },
                    { role: 'user', content: promptText + '\n\nRemember: ONLY return valid JSON. Every narrationSegment must be complete and detailed.' }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${trimmedApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 180000
            }
        );

        const text = response.data?.choices?.[0]?.message?.content || '';
        const parsed = extractJsonObject(text);
        return finalizeIdeas(parsed, { slideCount, topic: options.topic, modelName, videoMode });
    } catch (error) {
        const apiMsg = error.response?.data?.error?.message;
        throw new Error(apiMsg || error.message || 'Gagal meminta ide ke OpenAI.');
    }
}

async function generateIdeasClaude(apiKey, options = {}) {
    const trimmedApiKey = (apiKey || '').trim();
    if (!trimmedApiKey) {
        throw new Error('API key Claude wajib diisi.');
    }

    const videoMode = options.videoMode || 'short';
    const preset = VIDEO_MODE_PRESETS[videoMode] || VIDEO_MODE_PRESETS.short;
    const slideCount = Math.max(1, Math.min(60, Number(options.slideCount) || preset.slideCount));
    const count = Math.max(1, Math.min(10, Number(options.count) || 5));
    const modelName = (options.model || 'claude-sonnet-4-5').trim();
    const usedTitles = Array.from(readUsedTitles());
    const promptBuilder = selectPromptBuilder(videoMode);
    const promptText = promptBuilder({ topic: options.topic, slideCount, count, usedTitles });
    const maxTokens = videoMode === 'long' ? 16000 : videoMode === 'medium' ? 8000 : 4096;
    const systemContent = videoMode === 'long'
        ? 'Kamu adalah penulis skrip video dokumenter profesional Indonesia. Tulis narasi yang sangat mendalam, panjang, dan kaya informasi. Kembalikan dalam format JSON saja, tanpa teks lain.'
        : videoMode === 'medium'
        ? 'Kamu adalah host podcast Indonesia yang informatif dan engaging. Tulis narasi yang mengalir dan bernilai. Kembalikan dalam format JSON saja, tanpa teks lain.'
        : 'Kamu membuat ide video pendek unik dalam bahasa Indonesia. Kamu harus mengembalikan data dalam format JSON saja, tanpa teks lain.';

    try {
        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: modelName,
                max_tokens: maxTokens,
                system: systemContent,
                messages: [
                    { role: 'user', content: promptText + '\n\nRemember: ONLY return valid JSON, no prose. Every narrationSegment must be complete and detailed as instructed.' }
                ]
            },
            {
                headers: {
                    'x-api-key': trimmedApiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                timeout: 300000 // 5 menit untuk long-form
            }
        );

        const contentBlocks = response.data?.content || [];
        const text = contentBlocks
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n');
        const parsed = extractJsonObject(text);
        return finalizeIdeas(parsed, { slideCount, topic: options.topic, modelName, videoMode });
    } catch (error) {
        const apiMsg = error.response?.data?.error?.message;
        throw new Error(apiMsg || error.message || 'Gagal meminta ide ke Claude.');
    }
}

async function generateIdeasFor(provider, apiKey, options = {}) {
    const p = (provider || 'gemini').toLowerCase();
    if (p === 'openai' || p === 'chatgpt') return generateIdeasOpenAI(apiKey, options);
    if (p === 'claude' || p === 'anthropic') return generateIdeasClaude(apiKey, options);
    return generateIdeas(apiKey, options);
}

/**
 * Generic multi-provider chat call for plain-text prompts (metadata, captions, etc).
 * Returns plain string response.
 *
 * @param {string} provider   'gemini' | 'openai' | 'claude'
 * @param {string} apiKey     provider API key
 * @param {Object} params
 *   system   - optional system prompt
 *   user     - user prompt (required)
 *   model    - provider-specific model id (optional; sensible default used)
 *   maxTokens - cap on response length (default 2048)
 */
async function callChat(provider, apiKey, params = {}) {
    const trimmedKey = (apiKey || '').trim();
    if (!trimmedKey) {
        throw new Error(`API key untuk provider "${provider}" wajib diisi.`);
    }

    const prov = (provider || 'gemini').toLowerCase();
    const userPrompt = params.user || params.prompt;
    if (!userPrompt) throw new Error('user prompt diperlukan.');
    const systemPrompt = params.system || '';
    const maxTokens = params.maxTokens || 2048;

    if (prov === 'openai' || prov === 'chatgpt') {
        const model = params.model || 'gpt-4o-mini';
        try {
            const res = await axios.post('https://api.openai.com/v1/chat/completions', {
                model,
                messages: [
                    ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: maxTokens
            }, {
                headers: {
                    'Authorization': `Bearer ${trimmedKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000
            });
            return res.data?.choices?.[0]?.message?.content || '';
        } catch (err) {
            throw new Error(err.response?.data?.error?.message || err.message || 'OpenAI request failed');
        }
    }

    if (prov === 'claude' || prov === 'anthropic') {
        const model = params.model || 'claude-sonnet-4-5';
        try {
            const res = await axios.post('https://api.anthropic.com/v1/messages', {
                model,
                max_tokens: maxTokens,
                ...(systemPrompt ? { system: systemPrompt } : {}),
                messages: [{ role: 'user', content: userPrompt }]
            }, {
                headers: {
                    'x-api-key': trimmedKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                timeout: 120000
            });
            const blocks = res.data?.content || [];
            return blocks.filter(b => b.type === 'text').map(b => b.text).join('\n');
        } catch (err) {
            throw new Error(err.response?.data?.error?.message || err.message || 'Claude request failed');
        }
    }

    // Gemini default
    const model = params.model || DEFAULT_MODEL;
    try {
        const genAI = new GoogleGenerativeAI(trimmedKey, { apiVersion: 'v1' });
        const m = genAI.getGenerativeModel({ model });
        const result = await m.generateContent({
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            ...(systemPrompt ? { systemInstruction: systemPrompt } : {})
        });
        const response = await result.response;
        return response.text();
    } catch (err) {
        throw new Error(err.message || 'Gemini request failed');
    }
}

module.exports = {
    DEFAULT_MODEL,
    VIDEO_MODE_PRESETS,
    generateIdeas,
    generateIdeasFor,
    generateIdeasOpenAI,
    generateIdeasClaude,
    generateNarration,
    getTitleHistory,
    readUsedTitles,
    saveUsedTitle,
    callChat
};
