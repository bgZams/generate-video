/**
 * YouTube Metadata Generation Service
 * Generates optimized titles, descriptions, hashtags, and tags for YouTube
 * Uses OpenAI for intelligent suggestions
 */

const axios = require('axios');

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Generate title variations for YouTube with keywords
 * @param {string} mainTitle - Main video title
 * @param {string} topic - Video topic/category
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} {titles: Array, keywords: Array}
 */
async function generateTitleVariations(mainTitle, topic, apiKey) {
    if (!mainTitle || !mainTitle.trim()) {
        throw new Error('Main title diperlukan');
    }

    const prompt = `Buatkan 5 variasi judul YouTube yang menarik dan SEO-optimized untuk video dengan judul: "${mainTitle}" 
    Topik: ${topic || 'General'}
    
    Requirements:
    - Setiap judul 30-60 karakter (optimal untuk YouTube)
    - Gunakan power words (Amazing, Shocking, Secret, etc.)
    - Tambahkan number hook jika relevant
    - Include main keyword
    - Include long-tail keywords
    
    Format jawaban HANYA:
    1. [judul 1]
    2. [judul 2]
    3. [judul 3]
    4. [judul 4]
    5. [judul 5]`;

    try {
        const response = await axios.post(
            OPENAI_CHAT_URL,
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const content = response.data?.choices?.[0]?.message?.content || '';
        const titles = content
            .split('\n')
            .filter(line => line.match(/^\d+\./))
            .map(line => line.replace(/^\d+\.\s*/, '').trim())
            .filter(Boolean);

        return {
            primary: mainTitle,
            variations: titles,
            count: titles.length
        };
    } catch (error) {
        const apiError = error.response?.data?.error?.message;
        throw new Error(`Gagal generate title variations: ${apiError || error.message}`);
    }
}

/**
 * Generate YouTube description with SEO optimization
 * @param {string} title - Video title
 * @param {string} summary - Video summary/topic
 * @param {Array<string>} narrationPoints - Narration segments or key points
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} {description: string, hooks: Array}
 */
async function generateDescription(title, summary, narrationPoints, apiKey) {
    if (!title || !title.trim() || !summary || !summary.trim()) {
        throw new Error('Title dan summary diperlukan');
    }

    const points = Array.isArray(narrationPoints) 
        ? narrationPoints.slice(0, 5).join('\n- ')
        : '';

    const prompt = `Buatkan deskripsi YouTube yang menarik, engaging, dan SEO-optimized untuk video:
    
    Judul: ${title}
    Topik: ${summary}
    Key Points:
    - ${points}
    
    Requirements deskripsi:
    1. Hook pertama 2-3 baris yang menarik perhatian
    2. Main content 3-4 baris (2000 character limit)
    3. CTA (Call to Action) jelas
    4. Include relevant keywords naturally
    5. Format dengan line breaks yang rapi
    
    Format jawaban:
    [Tulis deskripsi langsung]`;

    try {
        const response = await axios.post(
            OPENAI_CHAT_URL,
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.8,
                max_tokens: 500
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const description = response.data?.choices?.[0]?.message?.content || '';

        return {
            description: description.slice(0, 5000),
            length: description.length,
            optimized: true
        };
    } catch (error) {
        const apiError = error.response?.data?.error?.message;
        throw new Error(`Gagal generate description: ${apiError || error.message}`);
    }
}

/**
 * Generate hashtags dan tags untuk YouTube
 * @param {string} title - Video title
 * @param {string} topic - Video topic
 * @param {Array<string>} keywords - Additional keywords
 * @param {string} apiKey - OpenAI API key
 * @returns {Promise<Object>} {hashtags: Array, tags: Array}
 */
async function generateHashtagsAndTags(title, topic, keywords = [], apiKey) {
    if (!title || !title.trim()) {
        throw new Error('Title diperlukan');
    }

    const keywordList = keywords.slice(0, 5).join(', ');

    const prompt = `Buatkan hashtags dan tags YouTube untuk video:
    Judul: ${title}
    Topik: ${topic}
    Keywords: ${keywordList}
    
    Requirements:
    - 10-15 hashtags (max karena YouTube limit)
    - 15-20 tags yang relevan
    - Include trending hashtags dalam genre
    - Mix broad dan specific hashtags
    - Avoid hashtags yang terlalu clickbait
    
    Format jawaban HANYA:
    HASHTAGS:
    #hashtag1 #hashtag2 #hashtag3 ...
    
    TAGS:
    tag1, tag2, tag3, tag4, ...`;

    try {
        const response = await axios.post(
            OPENAI_CHAT_URL,
            {
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 300
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey.trim()}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );

        const content = response.data?.choices?.[0]?.message?.content || '';
        
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
        const apiError = error.response?.data?.error?.message;
        throw new Error(`Gagal generate hashtags: ${apiError || error.message}`);
    }
}

/**
 * Generate complete YouTube metadata
 * @param {Object} params - Generation parameters
 * @returns {Promise<Object>} Complete metadata object
 */
async function generateYouTubeMetadata(params) {
    const {
        title,
        topic,
        summary,
        narrationPoints = [],
        keywords = [],
        apiKey
    } = params;

    if (!apiKey) {
        throw new Error('OpenAI API key diperlukan');
    }

    if (!title || !topic) {
        throw new Error('Title dan topic diperlukan');
    }

    console.log('📝 Generating YouTube metadata...');

    try {
        const [titleVars, desc, meta] = await Promise.all([
            generateTitleVariations(title, topic, apiKey),
            generateDescription(title, summary || topic, narrationPoints, apiKey),
            generateHashtagsAndTags(title, topic, keywords, apiKey)
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

        console.log('✅ YouTube metadata generated successfully');
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
