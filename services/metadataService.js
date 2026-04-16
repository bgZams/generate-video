/**
 * YouTube Metadata Generation Service
 * Multi-provider (Gemini / OpenAI / Claude) — picks whichever token the user
 * configured in the browser so quota bounces on one provider don't break
 * the whole automation pipeline.
 */

const { callChat } = require('./narration_service');

/**
 * Generate title variations for YouTube with viral hooks and SEO
 */
async function generateTitleVariations(mainTitle, topic, apiKey, provider = 'gemini', model = '') {
    if (!mainTitle || !mainTitle.trim()) {
        throw new Error('Main title diperlukan');
    }

    const prompt = `Buatkan 5 variasi judul YouTube SHORTS yang sangat VIRAL, CLICKBAIT (tapi jujur), dan SEO-optimized untuk video: "${mainTitle}"
Topik: ${topic || 'General'}

Requirements:
- Target: Penonton Indonesia (gaya bahasa "fyp" dan bikin penasaran)
- Teknik Clickbait Positif: Curiosity Gap, Emotional Hook, atau "Did you know?"
- Setiap judul 30-70 karakter.
- Power words Indonesia: "Terungkap", "Misteri", "Jangan Kaget", "Ternyata", "Wajib Tahu".

Format jawaban HANYA list angka:
1. [judul 1]
2. [judul 2]
3. [judul 3]
4. [judul 4]
5. [judul 5]`;

    try {
        const content = await callChat(provider, apiKey, {
            system: 'You are an expert YouTube SEO and Viral Content strategist specializing in Indonesian audience and YouTube Shorts.',
            user: prompt,
            model,
            maxTokens: 1024
        });

        const titles = content
            .split('\n')
            .filter(line => line.match(/^\d+\./))
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(Boolean);

        return {
            primary: mainTitle,
            variations: titles.length > 0 ? titles : [mainTitle],
            count: titles.length
        };
    } catch (error) {
        throw new Error(`Gagal generate title variations: ${error.message}`);
    }
}

/**
 * Generate YouTube description with SEO optimization for Shorts
 */
async function generateDescription(title, summary, narrationPoints, apiKey, provider = 'gemini', model = '') {
    if (!title || !title.trim() || !summary || !summary.trim()) {
        throw new Error('Title dan summary diperlukan');
    }

    const points = Array.isArray(narrationPoints)
        ? narrationPoints.slice(0, 5).join('\n- ')
        : '';

    const prompt = `Buatkan deskripsi YouTube SHORTS yang singkat, padat, dan penuh kata kunci (SEO) untuk video:

Judul: ${title}
Topik: ${summary}
Poin Penting:
- ${points}

Requirements deskripsi:
1. Baris pertama harus HOOK yang sangat bikin penasaran (untuk preview di pencarian).
2. Gunakan gaya bahasa storytelling singkat.
3. Masukkan 3-5 hashtag di dalam deskripsi.
4. Tambahkan ajakan Subscribe (CTA) yang natural.

Format jawaban:
[Tulis deskripsi langsung]`;

    try {
        const description = await callChat(provider, apiKey, {
            system: 'You are a YouTube Shorts copywriter optimizing for Indonesian audience SEO.',
            user: prompt,
            model,
            maxTokens: 1024
        });

        return {
            description: description.slice(0, 5000),
            length: description.length,
            optimized: true
        };
    } catch (error) {
        throw new Error(`Gagal generate description: ${error.message}`);
    }
}

/**
 * Generate hashtags dan tags YouTube yang Trending/FYP
 */
async function generateHashtagsAndTags(title, topic, keywords = [], apiKey, provider = 'gemini', model = '') {
    if (!title || !title.trim()) {
        throw new Error('Title diperlukan');
    }

    const prompt = `Buatkan 15 hashtags dan 20 tags YouTube yang paling TRENDING dan FYP untuk genre "${topic}" berdasarkan judul: "${title}".

Requirements:
- Wajib sertakan hashtag populer seperti: #Shorts, #FaktaUnik, #Misteri, #Viral, #Trending, #Edukasi, #FYP.
- Tags harus campuran antara broad topic dan specific details.
- Gunakan kata kunci yang sering diketik orang di kolom pencarian.

Format jawaban HANYA:
HASHTAGS:
#hashtag1 #hashtag2 #hashtag3 ...

TAGS:
tag1, tag2, tag3, tag4, ...`;

    try {
        const content = await callChat(provider, apiKey, {
            system: 'You are a YouTube SEO expert producing hashtags and tags for Indonesian Shorts.',
            user: prompt,
            model,
            maxTokens: 1024
        });

        // Parse hashtags
        const hashtagMatch = content.match(/HASHTAGS:\s*\n?(.*?)(?=TAGS:|$)/s);
        const hashtags = hashtagMatch
            ? hashtagMatch[1].trim().split(/\s+/).filter(h => h.startsWith('#'))
            : [];

        // Parse tags
        const tagsMatch = content.match(/TAGS:\s*\n?(.*?)$/s);
        const tags = tagsMatch
            ? tagsMatch[1].trim().split(/,\s*/).filter(t => t.trim())
            : [];

        return {
            hashtags: hashtags.slice(0, 15),
            tags: tags.slice(0, 20),
            combined: [...hashtags, ...tags].slice(0, 30)
        };
    } catch (error) {
        throw new Error(`Gagal generate hashtags: ${error.message}`);
    }
}

/**
 * Generate complete YouTube metadata
 * @param {Object} params - Generation parameters (title, topic, summary,
 *                          narrationPoints, keywords, apiKey, provider, model)
 * @returns {Promise<Object>} Complete metadata object
 */
async function generateYouTubeMetadata(params) {
    const {
        title,
        topic,
        summary,
        narrationPoints = [],
        keywords = [],
        apiKey,
        provider = 'gemini',
        model = ''
    } = params;

    if (!apiKey) {
        throw new Error(`API key untuk ${provider} diperlukan`);
    }

    if (!title || !topic) {
        throw new Error('Title dan topic diperlukan');
    }

    console.log(`📝 Generating YouTube metadata via ${provider}${model ? ` (${model})` : ''}...`);

    try {
        const [titleVars, desc, meta] = await Promise.all([
            generateTitleVariations(title, topic, apiKey, provider, model),
            generateDescription(title, summary || topic, narrationPoints, apiKey, provider, model),
            generateHashtagsAndTags(title, topic, keywords, apiKey, provider, model)
        ]);

        const metadata = {
            primary: {
                title: title,
                topic: topic,
                summary: summary
            },
            titles: titleVars,
            description: desc.description,
            hashtags: meta.hashtags,
            tags: meta.tags,
            combined: meta.combined,
            keywords: keywords,
            generatedAt: new Date().toISOString(),
            status: 'ready'
        };

        console.log(`✅ YouTube metadata generated successfully via ${provider}`);
        return metadata;
    } catch (error) {
        console.error('❌ Error generating metadata:', error.message);
        throw error;
    }
}

module.exports = {
    generateTitleVariations,
    generateDescription,
    generateHashtagsAndTags,
    generateYouTubeMetadata
};
