# Quick Start Guide

## 🚀 Getting Started (30 seconds)

### 1. Start Server
```bash
npm start
```
Server runs on: **http://localhost:3000**

### 2. Fill in the AI Panel
- **Tema / Brief**: Describe your video topic
  - Example: "Tips membuat konten TikTok viral"
- **Jumlah Ide**: How many ideas to generate (1-10, default 5)
- **Model**: Leave as `gpt-4o-mini` (fastest, cheapest)

### 3. Click "Generate Judul & Narasi"
- Wait 5-10 seconds for OpenAI to process
- Watch the magic happen! ✨

### 4. Automatic Magic 🎯
- **First idea auto-applies** to your slides
- **Slides auto-adjust** to match narration count
- **Title auto-fills** the "Judul Video" field
- **Status updates** to show what happened

### 5. (Optional) Switch Ideas
- Browse alternative ideas in "Hasil AI" sidebar
- Click "Pakai ke Slide" on any idea to apply it
- Check "Riwayat Judul" for ideas you've used before

---

## 📝 Complete Workflow Example

**Scenario**: Create a 3-slide TikTok video about productivity tips

### Step 1: Prepare
1. You already have 1 slide created (default)
2. Topic: "Tips produktivitas kerja dari rumah"
3. Idea count: 5 ideas

### Step 2: Generate
1. Fill in topic and idea count
2. Click "Generate Judul & Narasi"
3. Observe the debug info showing 5 ideas being generated

### Step 3: Auto-Apply ✅
1. First idea automatically appears in slides
2. System creates additional slides to match narration segments
3. If idea has 3 narration segments:
   - Old: 1 slide
   - New: 3 slides (auto-created!)
4. Each slide gets filled with its narration text

### Step 4: Customize (Optional)
1. Edit narration text in each slide
2. Change background image source (Auto/Upload/URL)
3. Try other ideas by clicking "Pakai ke Slide"

### Step 5: Next Steps
1. Add background music
2. Generate video (when feature is available)
3. Export and share

---

## ⚡ Common Questions

### Q: How long does generation take?
**A**: 5-10 seconds (depends on OpenAI processing time)

### Q: Can I adjust the number of slides after generation?
**A**: Yes! However, the next generation will auto-adjust to then number you have.
To get exactly N slides, make sure you have N slides BEFORE generating.

### Q: What if I don't like the first idea?
**A**: Click "Pakai ke Slide" on any other idea in the "Hasil AI" panel.

### Q: Where are my generated ideas saved?
**A**: `data/title_history.json` on the server. Check in "Riwayat Judul" panel.

### Q: Can I use my own API key?
**A**: Yes! Edit the `.env` file:
```
OPENAI_API_KEY=your-key-here
```
Then restart: `npm start`

### Q: Which model should I use?
**A**: 
- **gpt-4o-mini** ← Recommended (fast, cheap)
- gpt-4 (slower, more creative, expensive)
- gpt-3.5-turbo (legacy, not recommended)

---

## 🔍 Debugging Checklist

If something doesn't work:

- [ ] Is server running? (`npm start`)
- [ ] Visit http://localhost:3000 working?
- [ ] `.env` file has `OPENAI_API_KEY`?
- [ ] OpenAI balance available? (check https://platform.openai.com/)
- [ ] Internet connection active?
- [ ] Browser console clear of errors? (F12 → Console)
- [ ] Try refreshing page (Ctrl+F5)?
- [ ] Try clearing browser cache?

### View Logs
```bash
# Terminal where server is running shows all API calls
# Look for "DEBUG - " messages
```

---

## 📊 What's Happening Behind the Scenes

```
You Click Generate
    ↓
Frontend sends: { topic, slideCount, count, model }
    ↓
Server receives request
    ↓
Server calls OpenAI API
    ↓
OpenAI returns JSON with ideas + narration segments
    ↓
Server validates and auto-pads segments
    ↓
Server saves to history (data/title_history.json)
    ↓
Frontend receives ideas
    ↓
Auto-Apply FIRST idea
    ↓
Slides auto-create/delete to match segment count
    ↓
Each slide filled with narration text
    ↓
✅ Done!
```

---

## 💡 Pro Tips

1. **Specific Topics** → Better ideas
   - ✅ "5 cara meningkatkan engagement di Instagram Reels"
   - ❌ "tips Instagram"

2. **Same Topic, New Request?**
   - Server checks history and won't generate duplicate ideas

3. **Need More Slides?**
   - Click "Tambah Slide" button BEFORE generating
   - System will auto-adjust to that count

4. **Save Your Favorites**
   - Used ideas appear in "Riwayat Judul" panel
   - Easy to reuse later

5. **Multiple Models?**
   - Try different models to get varied narration styles
   - gpt-4o-mini is most consistent

---

## 🎯 Success Indicators

✅ You're doing it right if:
- Ideas appear within 10 seconds
- Slides auto-create without clicking "Tambah Slide"
- Narration text appears in each slide
- Title field gets filled automatically
- "Hasil AI" panel shows multiple idea options

❌ Something's wrong if:
- Gets stuck on "OpenAI sedang membuat..."
- Slides don't increase after generation
- No ideas appear in results
- Error message in status area

---

## 🆘 Emergency Reset

If everything is broken, try:

```bash
# 1. Stop server (Ctrl+C)
# 2. Clear history
rm data/title_history.json

# 3. Restart
npm start

# 4. Test
node test-implementation.js
node test-api.js
```

---

## 🎉 You're All Set!

Start generating your video ideas now at: **http://localhost:3000**

Questions? Check the full documentation in `IMPLEMENTATION_COMPLETE.md`

Happy creating! 🚀
