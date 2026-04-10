const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');

const dataDir = path.join(__dirname, '..', 'data');
const historyFile = path.join(dataDir, 'title_history.json');
const legacyUsedTitlesFile = path.join(__dirname, '..', 'used_titles.txt');
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

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
        source: 'openai'
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

function extractTextFromResponse(data) {
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
        return content.trim();
    }
    throw new Error('Tidak bisa extract respons dari OpenAI');
}

function buildPrompt({ topic, slideCount, count, usedTitles }) {
    const safeTopic = topic?.trim() || 'Buat tema video pendek yang menarik untuk konten Indonesia.';
    const exclusions = usedTitles.length
        ? `Jangan ulangi atau mirip dengan judul berikut: ${usedTitles.join(' | ')}.`
        : 'Belum ada judul terpakai sebelumnya.';

    return [
        `Tema utama: ${safeTopic}`,
        `Buat ${count} ide judul video dalam bahasa Indonesia.`,
        `Setiap ide harus punya ${slideCount} potongan narasi, satu potongan untuk satu slide.`,
        'Gaya narasi harus padat, natural, enak dibacakan voice over, dan cocok untuk video pendek.',
        'Setiap potongan narasi maksimal 2 kalimat pendek.',
        exclusions
    ].join('\n');
}

async function generateIdeas(apiKey, options = {}) {
    const trimmedApiKey = (apiKey || '').trim();
    if (!trimmedApiKey) {
        throw new Error('API key OpenAI wajib diisi.');
    }

    const slideCount = Math.max(1, Math.min(20, Number(options.slideCount) || 1));
    const count = Math.max(1, Math.min(10, Number(options.count) || 5));
    const model = (options.model || DEFAULT_MODEL).trim();
    const usedTitles = Array.from(readUsedTitles());
    const usedTitleKeys = new Set(usedTitles.map(normalizeTitle));
    const prompt = buildPrompt({
        topic: options.topic,
        slideCount,
        count,
        usedTitles
    });

    let response;
    try {
        response = await axios.post(OPENAI_CHAT_URL, {
            model,
            messages: [
                {
                    role: 'system',
                    content: 'Kamu membuat ide video pendek unik dalam bahasa Indonesia. Return JSON saja, sesuai schema.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
                        response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'video_idea_list',
                    strict: true,
                    schema: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            ideas: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        title: { type: 'string' },
                                        summary: { type: 'string' },
                                        narrationSegments: {
                                            type: 'array',
                                            items: { type: 'string' }
                                        }
                                    },
                                    required: ['title', 'summary', 'narrationSegments']
                                }
                            }
                        },
                        required: ['ideas']
                    }
                }
            }
        }, {
            headers: {
                Authorization: `Bearer ${trimmedApiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000
        });
    } catch (error) {
        const apiMessage = error.response?.data?.error?.message;
        throw new Error(apiMessage || 'Gagal meminta ide ke OpenAI.');
    }

    const payloadText = extractTextFromResponse(response.data);
    if (!payloadText) {
        throw new Error('Respons OpenAI tidak berisi teks hasil.');
    }

    let parsed;
    try {
        parsed = JSON.parse(payloadText);
    } catch (error) {
        throw new Error('Gagal membaca respons JSON dari OpenAI.');
    }

    const rawIdeas = Array.isArray(parsed.ideas) ? parsed.ideas : [];
    console.log('DEBUG - rawIdeas from OpenAI:', JSON.stringify(rawIdeas, null, 2));
    console.log('DEBUG - slideCount requirement:', slideCount);
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

        // Pastikan narrationSegments sesuai dengan slideCount (auto-pad or trim)
        while (narrationSegments.length < slideCount) {
            narrationSegments.push('');  // Add empty if not enough
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
        model
    }));

    return {
        model,
        topic: options.topic || '',
        slideCount,
        ideas: savedIdeas
    };
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

module.exports = {
    DEFAULT_MODEL,
    generateIdeas,
    generateNarration,
    getTitleHistory,
    readUsedTitles,
    saveUsedTitle
};
