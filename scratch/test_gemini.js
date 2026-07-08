require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Import tryParseJsonResponse via a workaround (it's not exported)
// We'll inline-test the logic
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
                return text.substring(start, i + 1);
            }
        }
    }
    return null;
}

function tryParseJsonResponse(text) {
    if (!text || !text.trim()) throw new Error('Respons kosong dari AI.');
    try { return JSON.parse(text); } catch (_) {}
    
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
        try { return JSON.parse(match[0]); } catch (_) {}
    }

    const firstBrace = text.indexOf('{');
    if (firstBrace >= 0) {
        const extracted = extractFirstCompleteJsonObject(text, firstBrace);
        if (extracted) {
            try { return JSON.parse(extracted); } catch (_) {}
        }
    }

    throw new Error('All strategies failed');
}

// Test 1: Double closing brace (the actual Gemini bug)
console.log('=== Test: Double closing brace ===');
const doubleBrace = '{ "ideas": [{ "title": "Test", "summary": "Sum", "narrationSegments": ["seg1"] }] }\n}';
try {
    const result = tryParseJsonResponse(doubleBrace);
    console.log('✅ PASS - Parsed successfully:', JSON.stringify(result).substring(0, 100));
} catch (e) {
    console.log('❌ FAIL:', e.message);
}

// Test 2: Normal valid JSON
console.log('\n=== Test: Normal JSON ===');
const normal = '{ "ideas": [{ "title": "OK" }] }';
try {
    const result = tryParseJsonResponse(normal);
    console.log('✅ PASS:', JSON.stringify(result));
} catch (e) {
    console.log('❌ FAIL:', e.message);
}

// Test 3: JSON with curly braces inside strings
console.log('\n=== Test: Braces inside strings ===');
const braceInStr = '{ "ideas": [{ "title": "Hello {world}", "summary": "test}" }] }';
try {
    const result = tryParseJsonResponse(braceInStr);
    console.log('✅ PASS:', JSON.stringify(result));
} catch (e) {
    console.log('❌ FAIL:', e.message);
}

// Test 4: Live Gemini API call
console.log('\n=== Test: Live Gemini API call (long-form, 1 idea, 10 slides) ===');
async function testLive() {
    const apiKey = process.env.GEMINI_API_KEY;
    const genAI = new GoogleGenerativeAI(apiKey, { apiVersion: 'v1' });
    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const result = await model.generateContent({
        contents: [{ 
            role: 'user', 
            parts: [{ text: 'Buat 1 ide video YouTube tentang "Hijrah" dalam bahasa Indonesia. Return JSON only:\n{ "ideas": [{ "title": "string", "summary": "string", "narrationSegments": ["string (10 segments, each 50-100 words)"] }] }' }] 
        }],
        generationConfig: {
            responseMimeType: 'application/json',
            maxOutputTokens: 65536,
        },
        systemInstruction: 'Kamu adalah penulis skrip video dokumenter profesional Indonesia. Return JSON only.',
    });

    const response = await result.response;
    const text = response.text();
    console.log('Raw response length:', text.length);
    console.log('Finish reason:', response.candidates?.[0]?.finishReason);
    console.log('Last 50 chars:', JSON.stringify(text.substring(text.length - 50)));

    try {
        const parsed = tryParseJsonResponse(text);
        console.log('✅ PASS - Parsed! Ideas:', parsed.ideas?.length);
        console.log('Title:', parsed.ideas?.[0]?.title);
        console.log('Segments:', parsed.ideas?.[0]?.narrationSegments?.length);
    } catch (e) {
        console.log('❌ FAIL:', e.message);
    }
}

testLive().then(() => console.log('\nAll tests done.')).catch(e => console.error('Fatal:', e));
