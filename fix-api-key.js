const fs = require('fs');
const path = require('path');

console.log('🔧 Applying API Key Removal Changes...\n');

// 1. Fix public/index.html
console.log('1. Removing API key input from HTML...');
const htmlFile = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(htmlFile, 'utf8');
html = html.replace(
  /<div class="form-group">\s*<label for="openai_api_key">OpenAI API Key<\/label>.*?<\/div>\s*<div class="form-group">\s*<label for="openai_model">/s,
  '<div class="form-group">\n                            <label for="openai_model">'
);
html = html.replace(/gpt-5\.4-mini/g, 'gpt-4o-mini');
html = html.replace(/gpt-5\.4(?!-)/g, 'gpt-4');
html = html.replace(/gpt-5\.4-nano/g, 'gpt-3.5-turbo');
fs.writeFileSync(htmlFile, html);
console.log('   ✓ Removed API key input, fixed model names\n');

// 2. Fix public/app.js
console.log('2. Updating app.js...');
const appFile = path.join(__dirname, 'public', 'app.js');
let app = fs.readFileSync(appFile, 'utf8');
app = app.replace(/const apiKeyInput = document\.getElementById\('openai_api_key'\);\n/g, '');
app = app.replace(/const apiKey = apiKeyInput\.value\.trim\(\);\n/g, '');
app = app.replace(/if \(!apiKey\) \{\s*setIdeaStatus\('Isi OpenAI API key.*?\n\s*return;\s*\}\n/s, '');
app = app.replace(/apiKey,\n\s*topic,/g, 'topic,');
fs.writeFileSync(appFile, app);
console.log('   ✓ Removed API key references from app.js\n');

// 3. Fix services/narration_service.js
console.log('3. Updating narration_service.js model...');
const narrationFile = path.join(__dirname, 'services', 'narration_service.js');
let narration = fs.readFileSync(narrationFile, 'utf8');
narration = narration.replace(/const DEFAULT_MODEL = 'gpt-5\.4-mini'/g, "const DEFAULT_MODEL = 'gpt-4o-mini'");
fs.writeFileSync(narrationFile, narration);
console.log('   ✓ Updated DEFAULT_MODEL\n');

// 4. Fix server.js
console.log('4. Updating server.js...');
const serverFile = path.join(__dirname, 'server.js');
let server = fs.readFileSync(serverFile, 'utf8');
const oldDestructure = `        const {
            apiKey,
            topic,
            slideCount,
            count,
            model
        } = req.body || {};`;
const newDestructure = `        const {
            topic,
            slideCount,
            count,
            model
        } = req.body || {};`;
server = server.replace(oldDestructure, newDestructure);
server = server.replace(/const result = await generateIdeas\(apiKey,/g, 'const result = await generateIdeas(process.env.OPENAI_API_KEY,');
fs.writeFileSync(serverFile, server);
console.log('   ✓ Updated server.js to use process.env.OPENAI_API_KEY\n');

console.log('✅ All changes applied successfully!\n');
console.log('📝 Next steps:');
console.log('   1. Ensure you have .env file with: OPENAI_API_KEY=sk-proj-...');
console.log('   2. Run: npm install dotenv');
console.log('   3. Restart server');
console.log('   4. Browser: F5 reload\n');