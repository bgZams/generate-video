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

function buildPrompt({ topic, slideCount, count, usedTitles }) {
    const safeTopic = topic?.trim() || 'Buat tema video pendek yang menarik untuk konten Indonesia.';
    const exclusions = usedTitles.length
        ? `Jangan ulangi atau mirip dengan judul berikut: ${usedTitles.join(' | ')}.`
        : 'Belum ada judul terpakai sebelumnya.';

    return [
        `Tema utama: ${safeTopic}`,
        `Buat ${count} ide judul video YouTube SHORTS dalam bahasa Indonesia.`,
        '',
        'STRUKTUR NARASI WAJIB (professional Shorts format):',
        `- Total ${slideCount} potongan narasi, SATU potongan untuk SATU slide.`,
        `- Slide 1 = HOOK (3 detik pertama). WAJIB dimulai dengan pertanyaan memancing, angka mengejutkan, atau "Tahukah kamu...". Maksimal 1 kalimat singkat, padat, membuat penasaran.`,
        `- Slide 2 sampai ${slideCount - 1} = ISI / VALUE. Setiap slide berisi satu fakta, insight, atau langkah cerita. Bangun penasaran progresif (makin ke belakang makin klimaks).`,
        `- Slide ${slideCount} = CTA. Ajakan natural seperti "Follow untuk konten serupa setiap hari!" atau "Komen pendapatmu di bawah." Maksimal 1 kalimat.`,
        '',
        'GAYA BAHASA:',
        '- Padat, natural, conversational — seperti orang Indonesia bicara di TikTok/Reels.',
        '- Setiap potongan maksimal 2 kalimat pendek (< 15 kata per kalimat).',
        '- Gunakan kata hook: "ternyata", "faktanya", "jangan kaget", "diam-diam", "inilah alasannya".',
        '- Hindari bahasa kaku, jargon berlebih, atau kalimat panjang berbelit.',
        '',
        `Judul harus clickbait positif (bikin penasaran tapi jujur), 30-70 karakter, dalam bahasa Indonesia.`,
        `Summary singkat 1 kalimat yang merangkum isi video.`,
        '',
        'RETURN FORMAT:',
        'Return as JSON with this schema:',
        '{ "ideas": [ { "title": "string", "summary": "string", "narrationSegments": ["string"] } ] }',
        '',
        exclusions
    ].join('\n');
}

async function generateIdeas(apiKey, options = {}) {
    const trimmedApiKey = (apiKey || '').trim();
    if (!trimmedApiKey) {
        throw new Error('API key Gemini wajib diisi.');
    }

    const slideCount = Math.max(1, Math.min(20, Number(options.slideCount) || 1));
    const count = Math.max(1, Math.min(10, Number(options.count) || 5));
    const modelName = (options.model || DEFAULT_MODEL).replace('gpt-4o-mini', 'gemini-flash-latest').trim();
    console.log(`DEBUG - Using Gemini Model: "${modelName}"`);
    const usedTitles = Array.from(readUsedTitles());
    const usedTitleKeys = new Set(usedTitles.map(normalizeTitle));
    const promptText = buildPrompt({
        topic: options.topic,
        slideCount,
        count,
        usedTitles
    });

    try {
        const genAI = new GoogleGenerativeAI(trimmedApiKey, { apiVersion: 'v1' });
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // Use generateContent with options
        const result = await model.generateContent({
            contents: [{ 
                role: 'user', 
                parts: [{ text: promptText + "\n\nRemember: ONLY return valid JSON." }] 
            }],
            generationConfig: {
                responseMimeType: "application/json",
            },
            systemInstruction: 'Kamu membuat ide video pendek unik dalam bahasa Indonesia. Kamu harus mengembalikan data dalam format JSON saja.',
        });

        const response = await result.response;
        const text = response.text();
        
        // Clean markdown if any
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const payloadText = jsonMatch ? jsonMatch[0] : text;

        let parsed;
        try {
            parsed = JSON.parse(payloadText);
        } catch (error) {
            console.error('Failed to parse Gemini JSON:', text);
            throw new Error('Gagal membaca respons JSON dari Gemini.');
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
            model: modelName
        }));

        return {
            model: modelName,
            topic: options.topic || '',
            slideCount,
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

function extractJsonObject(text) {
    if (!text) throw new Error('Respons kosong dari AI.');
    const match = text.match(/\{[\s\S]*\}/);
    const payload = match ? match[0] : text;
    try {
        return JSON.parse(payload);
    } catch (err) {
        throw new Error('Gagal membaca respons JSON dari AI.');
    }
}

async function generateIdeasOpenAI(apiKey, options = {}) {
    const trimmedApiKey = (apiKey || '').trim();
    if (!trimmedApiKey) {
        throw new Error('API key OpenAI wajib diisi.');
    }

    const slideCount = Math.max(1, Math.min(20, Number(options.slideCount) || 1));
    const count = Math.max(1, Math.min(10, Number(options.count) || 5));
    const modelName = (options.model || 'gpt-4o-mini').trim();
    const usedTitles = Array.from(readUsedTitles());
    const promptText = buildPrompt({ topic: options.topic, slideCount, count, usedTitles });

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: modelName,
                response_format: { type: 'json_object' },
                messages: [
                    {
                        role: 'system',
                        content: 'Kamu membuat ide video pendek unik dalam bahasa Indonesia. Kamu harus mengembalikan data dalam format JSON saja.'
                    },
                    { role: 'user', content: promptText + '\n\nRemember: ONLY return valid JSON.' }
                ]
            },
            {
                headers: {
                    'Authorization': `Bearer ${trimmedApiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 120000
            }
        );

        const text = response.data?.choices?.[0]?.message?.content || '';
        const parsed = extractJsonObject(text);
        return finalizeIdeas(parsed, { slideCount, topic: options.topic, modelName });
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

    const slideCount = Math.max(1, Math.min(20, Number(options.slideCount) || 1));
    const count = Math.max(1, Math.min(10, Number(options.count) || 5));
    const modelName = (options.model || 'claude-sonnet-4-5').trim();
    const usedTitles = Array.from(readUsedTitles());
    const promptText = buildPrompt({ topic: options.topic, slideCount, count, usedTitles });

    try {
        const response = await axios.post(
            'https://api.anthropic.com/v1/messages',
            {
                model: modelName,
                max_tokens: 4096,
                system: 'Kamu membuat ide video pendek unik dalam bahasa Indonesia. Kamu harus mengembalikan data dalam format JSON saja, tanpa teks lain.',
                messages: [
                    { role: 'user', content: promptText + '\n\nRemember: ONLY return valid JSON, no prose.' }
                ]
            },
            {
                headers: {
                    'x-api-key': trimmedApiKey,
                    'anthropic-version': '2023-06-01',
                    'Content-Type': 'application/json'
                },
                timeout: 120000
            }
        );

        const contentBlocks = response.data?.content || [];
        const text = contentBlocks
            .filter(b => b.type === 'text')
            .map(b => b.text)
            .join('\n');
        const parsed = extractJsonObject(text);
        return finalizeIdeas(parsed, { slideCount, topic: options.topic, modelName });
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
