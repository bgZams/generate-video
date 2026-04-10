/**
 * Subtitle Generation Service
 * Converts narration text into SRT (SubRip) format with timing
 * Supports:
 * - Text splitting into subtitle chunks
 * - Automatic timing based on audio duration or reading speed
 * - SRT file generation
 * - VTT (WebVTT) format support
 */

const fs = require('fs');
const path = require('path');

/**
 * Split text into subtitle chunks (2-3 words per subtitle for readability)
 * @param {string} text - Full narration text
 * @param {number} wordsPerChunk - Words per subtitle line (default 3)
 * @returns {Array<string>} Array of subtitle chunks
 */
function splitIntoSubtitles(text, wordsPerChunk = 3) {
    if (!text || !text.trim()) {
        return [];
    }

    // Split by sentences first, then by word count
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const chunks = [];
    let currentChunk = [];
    let wordCount = 0;

    sentences.forEach(sentence => {
        const words = sentence.split(/\s+/);
        
        words.forEach(word => {
            currentChunk.push(word);
            wordCount++;

            if (wordCount >= wordsPerChunk) {
                chunks.push(currentChunk.join(' '));
                currentChunk = [];
                wordCount = 0;
            }
        });

        // Add remaining words from sentence
        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
            currentChunk = [];
            wordCount = 0;
        }
    });

    // Add any remaining words
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }

    return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Calculate timing for subtitles based on word count and speaking speed
 * @param {Array<string>} textChunks - Array of subtitle chunks
 * @param {number} totalDuration - Total audio duration in seconds (optional)
 * @param {number} wordsPerSecond - Speaking rate (default ~2.5 words/sec for normal speech)
 * @returns {Array<Object>} Array of {text, startTime, endTime}
 */
function calculateTiming(textChunks, totalDuration = null, wordsPerSecond = 2.5) {
    if (!textChunks || textChunks.length === 0) {
        return [];
    }

    const subtitles = [];
    let currentTime = 0;

    // If total duration provided, distribute evenly
    if (totalDuration) {
        const timePerChunk = totalDuration / textChunks.length;
        
        textChunks.forEach((text, index) => {
            const startTime = index * timePerChunk;
            const endTime = (index + 1) * timePerChunk;
            
            subtitles.push({
                index: index + 1,
                text,
                startTime: Math.max(0, startTime),
                endTime: Math.min(totalDuration, endTime),
                startTimeFormatted: formatTime(startTime),
                endTimeFormatted: formatTime(endTime)
            });
        });
    } else {
        // Calculate based on word count
        textChunks.forEach((text, index) => {
            const wordCount = text.split(/\s+/).length;
            const duration = wordCount / wordsPerSecond;
            const startTime = currentTime;
            const endTime = currentTime + duration;

            subtitles.push({
                index: index + 1,
                text,
                startTime,
                endTime,
                startTimeFormatted: formatTime(startTime),
                endTimeFormatted: formatTime(endTime)
            });

            currentTime = endTime + 0.1; // Small gap between subtitles
        });
    }

    return subtitles;
}

/**
 * Convert seconds to SRT time format (HH:MM:SS,mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTime(seconds) {
    const roundedSeconds = Math.round(seconds * 1000) / 1000;
    const hours = Math.floor(roundedSeconds / 3600);
    const minutes = Math.floor((roundedSeconds % 3600) / 60);
    const secs = Math.floor(roundedSeconds % 60);
    const ms = Math.round((roundedSeconds % 1) * 1000);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

/**
 * Convert seconds to VTT time format (HH:MM:SS.mmm)
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
function formatTimeVTT(seconds) {
    return formatTime(seconds).replace(',', '.');
}

/**
 * Generate SRT format subtitle file
 * @param {Array<Object>} subtitles - Array of subtitle objects
 * @param {string} outputPath - Output file path
 * @returns {string} Path to generated SRT file
 */
function generateSRT(subtitles, outputPath) {
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
        throw new Error('No subtitles provided');
    }

    const srtContent = subtitles
        .map(sub => {
            return `${sub.index}\n${sub.startTimeFormatted} --> ${sub.endTimeFormatted}\n${sub.text}\n`;
        })
        .join('\n');

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, srtContent, 'utf-8');
    console.log(`✅ SRT subtitle file generated: ${outputPath}`);
    
    return outputPath;
}

/**
 * Generate VTT format subtitle file (for HTML5 video)
 * @param {Array<Object>} subtitles - Array of subtitle objects
 * @param {string} outputPath - Output file path
 * @returns {string} Path to generated VTT file
 */
function generateVTT(subtitles, outputPath) {
    if (!Array.isArray(subtitles) || subtitles.length === 0) {
        throw new Error('No subtitles provided');
    }

    let vttContent = 'WEBVTT\n\n';
    
    subtitles.forEach(sub => {
        const startTime = formatTimeVTT(sub.startTime);
        const endTime = formatTimeVTT(sub.endTime);
        vttContent += `${startTime} --> ${endTime}\n${sub.text}\n\n`;
    });

    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, vttContent, 'utf-8');
    console.log(`✅ VTT subtitle file generated: ${outputPath}`);
    
    return outputPath;
}

/**
 * Generate subtitles from narration text (complete pipeline)
 * @param {string} narrationText - Full narration text
 * @param {number} audioDuration - Audio duration in seconds (optional)
 * @param {string} outputDir - Output directory
 * @param {string} filename - Base filename without extension
 * @returns {Object} {srtPath, vttPath, subtitles}
 */
function generateSubtitles(narrationText, audioDuration = null, outputDir = path.join(__dirname, '..', 'output'), filename = 'subtitles') {
    if (!narrationText || !narrationText.trim()) {
        throw new Error('Narration text is required');
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Split text into chunks
    const chunks = splitIntoSubtitles(narrationText, 3);
    
    // Calculate timing
    const subtitles = calculateTiming(chunks, audioDuration, 2.5);

    // Generate SRT
    const srtPath = path.join(outputDir, `${filename}.srt`);
    generateSRT(subtitles, srtPath);

    // Generate VTT
    const vttPath = path.join(outputDir, `${filename}.vtt`);
    generateVTT(subtitles, vttPath);

    return {
        srtPath,
        vttPath,
        subtitles,
        count: subtitles.length
    };
}

/**
 * Generate JSON format subtitles (for embedding in API responses)
 * @param {Array<Object>} subtitles - Array of subtitle objects
 * @returns {string} JSON string
 */
function generateJSON(subtitles) {
    return JSON.stringify(
        subtitles.map(sub => ({
            index: sub.index,
            text: sub.text,
            start: sub.startTime,
            end: sub.endTime
        })),
        null,
        2
    );
}

module.exports = {
    splitIntoSubtitles,
    calculateTiming,
    formatTime,
    formatTimeVTT,
    generateSRT,
    generateVTT,
    generateSubtitles,
    generateJSON
};
