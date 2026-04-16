/**
 * BGM (Background Music) Service
 * ENHANCED: Prefers local royalty-free music library, falls back to Pexels API
 * Supports automatic music selection based on video mood/tempo
 * ENHANCED: Topic-based music selection with randomization
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

const PEXELS_API_URL = 'https://api.pexels.com/videos/search';
const PEXELS_API_KEY = process.env.PEXELS_API_KEY; // Require in .env

// LOCAL MUSIC LIBRARY PATH
const MUSIC_LIBRARY_PATH = path.join(__dirname, 'music');

// Track recently used music to avoid repeats
const recentMusicQueue = [];
const MAX_QUEUE_SIZE = 5;

/**
 * Music moods/genres for video matching
 */
const MUSIC_MOODS = {
    'upbeat': 'upbeat, energetic, happy, fun',
    'calm': 'calm, relaxing, peaceful, meditative',
    'dramatic': 'dramatic, intense, powerful, suspenseful',
    'cinematic': 'cinematic, epic, grand, orchestral',
    'corporate': 'corporate, professional, business, jazzy',
    'chill': 'chill, lo-fi, ambient, lounge',
    'motivational': 'motivational, inspiring, uplifting, epic',
    'dark': 'dark, suspenseful, mysterious, horror'
};

/**
 * Topic-specific music keywords database
 */
const TOPIC_MUSIC_KEYWORDS = {
    // Animals
    'animal': 'wildlife, nature, adventure, documentary, safari',
    'gajah': 'nature, wildlife, epic, majestic',
    'ular': 'creepy, eerie, suspenseful, dark, danger',
    'burung': 'chirping, nature, peaceful, calm, birds',
    'singa': 'powerful, dramatic, intense, roar, wildlife',
    'kucing': 'cute, playful, fun, adorable, pets',
    'anjing': 'playful, energetic, fun, loyalty, upbeat',
    
    // Science & Facts
    'fakta': 'educational, informative, discovery, knowledge',
    'sains': 'scientific, educational, systematic, learning',
    'teknologi': 'futuristic, modern, tech, innovation, electronic',
    'sejarah': 'historical, epic, dramatic, storytelling, cinematic',
    'bintang': 'cosmic, space, mystery, wonder, majestic',
    
    // Lifestyle
    'diet': 'healthy, motivational, uplifting, active',
    'fitness': 'energetic, powerful, motivational, upbeat, intense',
    'yoga': 'peaceful, calm, meditative, relaxing, zen',
    'tips': 'helpful, educational, informative, practical',
    'uang': 'professional, corporate, motivational, success',
    
    // Horror & Dark
    'seram': 'creepy, eerie, dark, suspenseful, horror',
    'hantu': 'spooky, dark, creepy, mysterious, eerie',
    'misteri': 'mysterious, suspenseful, dark, thriller',
    
    // Food
    'masak': 'culinary, cooking, upbeat, fun, jazzy',
    'makanan': 'food, appetite, upbeat, fun, flavor',
    'resep': 'cooking, instructional, helpful, clear',
    
    // Music/Entertainment
    'musik': 'musical, rhythmic, energetic, upbeat, fun',
    'menari': 'rhythm, energetic, fun, upbeat, dance',
    'boneka': 'playful, fun, entertainment, cute, enjoyable'
};

/**
 * Random integer between min and max (inclusive)
 */
function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Random pick from array
 */
function randomPick(array) {
    if (!Array.isArray(array) || array.length === 0) return null;
    return array[Math.floor(Math.random() * array.length)];
}

/**
 * Extract keywords from title to find topic
 */
function extractTopicFromTitle(title = '') {
    if (!title) return null;
    
    const titleLower = title.toLowerCase();
    
    for (const [topic, keywords] of Object.entries(TOPIC_MUSIC_KEYWORDS)) {
        if (titleLower.includes(topic)) {
            return { topic, keywords };
        }
    }
    
    return null;
}

/**
 * Get random music file from local library by mood
 * @param {string} mood - Mood folder name
 * @returns {Object|null} Music info or null if not found
 */
function getMusicFromLocalLibrary(mood = 'upbeat') {
    try {
        if (!fs.existsSync(MUSIC_LIBRARY_PATH)) {
            return null;
        }

        // Try mood subfolder first
        const moodPath = path.join(MUSIC_LIBRARY_PATH, mood.toLowerCase());
        let files = [];

        if (fs.existsSync(moodPath) && fs.statSync(moodPath).isDirectory()) {
            files = fs.readdirSync(moodPath)
                .filter(f => /\.(mp3|wav|aac|m4a)$/i.test(f))
                .map(f => path.join(moodPath, f));
        }

        // Fallback to library root if no mood subfolder or no files in it
        if (files.length === 0) {
            files = fs.readdirSync(MUSIC_LIBRARY_PATH)
                .filter(f => /\.(mp3|wav|aac|m4a)$/i.test(f))
                .map(f => path.join(MUSIC_LIBRARY_PATH, f));
        }
        
        if (files.length === 0) {
            console.log(`  ℹ️ No local music found in ${MUSIC_LIBRARY_PATH}`);
            return null;
        }
        
        const selectedFile = randomPick(files);
        
        return {
            id: `local_${mood}_${path.basename(selectedFile)}`,
            title: path.basename(selectedFile, path.extname(selectedFile)),
            url: null,
            path: selectedFile,
            duration: null,
            mood: mood,
            source: 'local'
        };
    } catch (error) {
        console.log(`  ℹ️ Error accessing local library: ${error.message}`);
        return null;
    }
}

/**
 * Enhanced search for background music with randomization
 * Now includes page randomization and random pick from results
 * @param {string} mood - Mood/genre
 * @param {string} title - Video title (for topic extraction)
 * @param {number} minDuration - Minimum duration
 * @returns {Promise<Object>} Music data or null
 */
async function searchMusicByMood(mood = 'upbeat', title = null, minDuration = 20) {
    if (!PEXELS_API_KEY) {
        console.warn('⚠️ PEXELS_API_KEY not set in .env.');
        return null;
    }

    // Try topic-specific keywords first if title provided
    let searchQuery = MUSIC_MOODS[mood.toLowerCase()] || mood;
    
    if (title) {
        const topicInfo = extractTopicFromTitle(title);
        if (topicInfo) {
            // Combine topic keywords with mood for better results
            searchQuery = `${topicInfo.keywords}, ${searchQuery}`;
            console.log(`🎵 Topic detected: ${topicInfo.topic} - Search: "${searchQuery}"`);
        }
    }

    try {
        // Randomize page (1-3) to get different results
        const randomPage = randomInt(1, 3);
        
        const response = await axios.get(PEXELS_API_URL, {
            headers: {
                'Authorization': PEXELS_API_KEY
            },
            params: {
                query: searchQuery,
                per_page: 15,  // Get more results for better variety
                page: randomPage
            },
            timeout: 10000
        });

        const videos = response.data?.videos || [];

        if (!videos.length) {
            console.log(`⚠️ No music found for: ${searchQuery}`);
            return null;
        }

        // Filter by duration
        const validVideos = videos.filter(v => (v.duration || 0) >= minDuration);
        
        if (!validVideos.length) {
            return searchMusicByMood(mood, null, minDuration); // Fallback
        }

        // Random pick from valid results (NOT always first)
        const selectedTrack = randomPick(validVideos);

        if (!selectedTrack) {
            return null;
        }

        // Get best quality file
        const videoFiles = selectedTrack.video_files || [];
        const bestFile = videoFiles.reduce((best, current) => {
            if (!best) return current;
            return (current.quality === 'hd') ? current : best;
        });

        return {
            id: selectedTrack.id,
            title: selectedTrack.artist?.name || 'Pexels Music',
            url: bestFile?.link,
            duration: selectedTrack.duration,
            mood: mood,
            quality: bestFile?.quality
        };
    } catch (error) {
        if (error.response?.status === 401) {
            console.error('❌ Invalid Pexels API key');
        } else {
            console.error(`⚠️ Pexels search error: ${error.message}`);
        }
        return null;
    }
}

/**
 * Download music from URL
 * @param {string} url - Music URL from Pexels
 * @param {string} outputPath - Where to save the file
 * @returns {Promise<string>} Path to saved file
 */
async function downloadMusic(url, outputPath) {
    if (!url) {
        throw new Error('Music URL diperlukan');
    }

    try {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 60000
        });

        const outputDir = path.dirname(outputPath);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        return new Promise((resolve, reject) => {
            writer.on('finish', () => {
                console.log(`✅ Music downloaded: ${outputPath}`);
                resolve(outputPath);
            });
            writer.on('error', reject);
        });
    } catch (error) {
        throw new Error(`Gagal download music: ${error.message}`);
    }
}

/**
 * Get music and download automatically
 * ENHANCED: Prefers local library, falls back to Pexels API
 * Accepts title for topic-based selection
 * Tracks recent music to avoid repeats
 * @param {string} mood - Video mood
 * @param {string} title - Video title (for topic extraction)
 * @param {string} outputDir - Output directory
 * @returns {Promise<Object>} Music info with local path
 */
async function getMusicByMood(mood = 'upbeat', title = null, outputDir = path.join(__dirname, '..', 'output')) {
    try {
        let selectedMood = mood;
        
        // PRIORITY 1: Try local music library first
        console.log(`🎵 Checking local music library for mood: ${selectedMood}...`);
        let localMusic = getMusicFromLocalLibrary(selectedMood);
        
        if (localMusic) {
            console.log(`✅ Local music found: ${localMusic.title}`);
            return {
                ...localMusic,
                source: 'local',
                timestamp: new Date().toISOString()
            };
        }
        
        console.log(`  ℹ️ Local music not available, falling back to Pexels API...`);
        
        // PRIORITY 2: Fall back to Pexels API
        let musicInfo = null;
        let attempts = 0;
        
        while (!musicInfo && attempts < 3) {
            musicInfo = await searchMusicByMood(selectedMood, title);
            
            // Check if this music was recently used
            if (musicInfo && recentMusicQueue.includes(musicInfo.id)) {
                console.log(`🔄 Music ${musicInfo.id} recently used, trying another...`);
                musicInfo = null; // Try again
                attempts++;
                continue;
            }
            
            if (!musicInfo && attempts === 0) {
                // Fallback: try without title if first attempt fails
                musicInfo = await searchMusicByMood(selectedMood, null);
            }
            
            attempts++;
        }

        if (!musicInfo || !musicInfo.url) {
            console.warn(`⚠️ Could not find music for mood: ${mood}`);
            return {
                source: 'default',
                mood: mood,
                url: null,
                path: null,
                note: 'No copyright-free music found, use your own'
            };
        }

        // Track this music to avoid using it again soon
        recentMusicQueue.push(musicInfo.id);
        if (recentMusicQueue.length > MAX_QUEUE_SIZE) {
            recentMusicQueue.shift();
        }

        // Download the music with unique filename including timestamp
        const timestamp = Date.now();
        const filename = `bgm_${mood}_${musicInfo.id}_${timestamp}.mp3`;
        const localPath = path.join(outputDir, filename);

        await downloadMusic(musicInfo.url, localPath);

        console.log(`✅ Music selected: ${musicInfo.title || 'Pexels Music'} (ID: ${musicInfo.id})`);

        return {
            source: 'pexels',
            mood: mood,
            title: musicInfo.title,
            url: musicInfo.url,
            path: localPath,
            duration: musicInfo.duration,
            artist: 'Pexels Music',
            id: musicInfo.id,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error(`❌ Error getting music: ${error.message}`);
        return {
            source: 'error',
            mood: mood,
            error: error.message,
            note: 'Music download failed, use default'
        };
    }
}

/**
 * Get list of popular royalty-free music services
 * Returns URLs and configurations
 */
function getFreeMusicServices() {
    return {
        pexels: {
            name: 'Pexels Music',
            url: 'https://www.pexels.com/search/videos/?query=music',
            api: 'https://api.pexels.com/videos',
            requiresKey: true,
            note: 'Free API with key'
        },
        pixabay: {
            name: 'Pixabay Music',
            url: 'https://pixabay.com/music/',
            api: 'https://pixabay.com/api/videos',
            requiresKey: true,
            note: 'Free API with key'
        },
        freepd: {
            name: 'FreePD',
            url: 'https://freepd.com/',
            api: null,
            requiresKey: false,
            note: 'Free music library, no API'
        },
        unminus: {
            name: 'Unminus',
            url: 'https://www.unminus.com/',
            api: null,
            requiresKey: false,
            note: 'Free royalty-free music'
        },
        bensound: {
            name: 'Bensound',
            url: 'https://www.bensound.com/',
            api: null,
            requiresKey: false,
            note: 'Free music with attribution'
        },
        youtube_audio: {
            name: 'YouTube Audio Library',
            url: 'https://www.youtube.com/audiolibrary',
            api: null,
            requiresKey: false,
            note: 'YouTube Studio feature'
        }
    };
}

/**
 * Analyze video mood from text (ENHANCED)
 * More comprehensive mood detection with keyword weighting
 * Returns suggested music mood based on content
 * @param {string} text - Video narration text
 * @returns {string} Suggested mood (upbeat, calm, dramatic, etc.)
 */
function analyzeMoodFromText(text) {
    if (!text) return 'upbeat';

    const textLower = text.toLowerCase();

    // Enhanced mood keywords with better coverage
    const moods = {
        'upbeat': [
            'amazing', 'awesome', 'incredible', 'fantastic', 'wonderful', 'exciting', 'fun', 'happy', 'enjoy',
            'luar biasa', 'menakjubkan', 'fantastis', 'menyenangkan', 'seru', 'hebat', 'bagus', 'keren',
            'wow', 'wow wow', 'cepat', 'energi', 'energik', 'meriah', 'riuh'
        ],
        'calm': [
            'peace', 'relax', 'calm', 'serene', 'quiet', 'gentle', 'soft', 'meditation', 'zen', 'nature',
            'damai', 'santai', 'tenang', 'lembut', 'meditasi', 'alam', 'nyaman', 'rileks',
            'perlahan', 'pelan', 'slow', 'harmoni', 'keseimbangan', 'kedamaian'
        ],
        'dramatic': [
            'shocking', 'incredible', 'unbelievable', 'intense', 'powerful', 'extreme', 'dangerous', 'mystery',
            'mengejutkan', 'intens', 'ekstrem', 'berbahaya', 'misterius', 'dramatis', 'terrible', 'scary',
            'mengerikan', 'mencengangkan', 'brutal', 'keras', 'kuat', 'dahsyat'
        ],
        'motivational': [
            'success', 'achieve', 'inspiration', 'powerful', 'strength', 'goal', 'dream', 'victory', 'triumph',
            'sukses', 'semangat', 'inspirasi', 'kuat', 'tujuan', 'impian', 'menang', 'juara',
            'motivasi', 'berani', 'tekad', 'perjuangan', 'usaha', 'kerja keras'
        ],
        'dark': [
            'dark', 'mystery', 'secret', 'suspense', 'danger', 'fear', 'horror', 'mysterious', 'unknown',
            'gelap', 'misteri', 'rahasia', 'ketakutan', 'horor', 'tersembunyi', 'tidak diketahui',
            'menakutkan', 'seram', 'hantu', 'seram', 'mistis', 'gaib'
        ],
        'chill': [
            'chill', 'lofi', 'ambient', 'groove', 'vibe', 'smooth', 'mellow', 'laid back', 'cool', 'ice',
            'santai', 'rileks', 'smooth', 'groovy', 'asik', 'cihui', 'asyik', 'nyantai'
        ]
    };

    // Score each mood - count keyword matches
    const scores = {};
    for (const [mood, keywords] of Object.entries(moods)) {
        scores[mood] = keywords.filter(kw => textLower.includes(kw)).length;
    }

    // Return mood with highest score, with tiebreaker randomization
    const maxScore = Math.max(...Object.values(scores));
    
    if (maxScore === 0) {
        // No keywords matched - default based on text length (longer = more upbeat by default)
        return textLower.length > 100 ? 'upbeat' : 'calm';
    }

    const topMoods = Object.entries(scores).filter(([_, score]) => score === maxScore).map(([mood]) => mood);
    
    // If tie, randomly pick one of the top moods for variety
    const selectedMood = randomPick(topMoods);

    console.log(`📊 Mood analysis: "${textLower.substring(0, 50)}..." → ${selectedMood} (score: ${maxScore})`);
    
    return selectedMood;
}

/**
 * Get music history (recently used tracks)
 */
function getMusicHistory() {
    return {
        recent: recentMusicQueue.slice(),
        total: recentMusicQueue.length,
        max: MAX_QUEUE_SIZE
    };
}

/**
 * Clear music history to allow repeats
 */
function clearMusicHistory() {
    recentMusicQueue.length = 0;
    console.log('🗑️ Music history cleared');
}

/**
 * Get list of all available local music files
 * Recursively scans the music library
 * @returns {Array<Object>} List of music files
 */
function getLocalMusicList() {
    try {
        if (!fs.existsSync(MUSIC_LIBRARY_PATH)) return [];

        const results = [];
        
        function scanDir(dirPath, category = 'General') {
            const items = fs.readdirSync(dirPath);
            
            for (const item of items) {
                const fullPath = path.join(dirPath, item);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDir(fullPath, item);
                } else if (/\.(mp3|wav|aac|m4a)$/i.test(item)) {
                    results.push({
                        filename: item,
                        name: path.basename(item, path.extname(item)),
                        category: category,
                        fullPath: fullPath
                    });
                }
            }
        }

        scanDir(MUSIC_LIBRARY_PATH);
        return results;
    } catch (error) {
        console.error('Error listing local music:', error);
        return [];
    }
}

module.exports = {
    searchMusicByMood,
    downloadMusic,
    getMusicByMood,
    getMusicFromLocalLibrary,
    getLocalMusicList,
    getFreeMusicServices,
    analyzeMoodFromText,
    extractTopicFromTitle,
    getMusicHistory,
    clearMusicHistory,
    MUSIC_MOODS,
    TOPIC_MUSIC_KEYWORDS
};
