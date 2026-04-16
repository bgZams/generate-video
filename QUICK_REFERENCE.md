# 🚀 Quick Reference Guide - YouTube Enhancement Features

**For Developers & Users**

---

## 🎬 Generate YouTube Video - Complete Workflow

### Step 1: Setup
```bash
# Install dependencies (first time only)
npm install

# Add API keys to .env
OPENAI_API_KEY=sk_...
PEXELS_API_KEY=your_key_here
```

### Step 2: Start Server
```bash
npm start
# Server running on http://localhost:3000
```

### Step 3A: Generate Narration (Existing)
```bash
curl -X POST http://localhost:3000/api/narration/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "Interesting Facts",
    "slideCount": 3,
    "count": 3,
    "model": "gpt-4o-mini"
  }'

# Response includes: ideas, narrationSegments
```

### Step 3B: Generate Audio (Existing)
```bash
curl -X POST http://localhost:3000/api/tts/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your narration text here",
    "voice": "shimmer",  # shimmer, nova, alloy, fable, onyx
    "speed": 1.0         # 0.75, 1.0, 1.25, 1.5
  }'

# Response: Audio MP3 blob
```

### Step 4: Generate Subtitles ✨ NEW
```bash
curl -X POST http://localhost:3000/api/subtitles/generate \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your narration text here",
    "duration": 30,          # optional
    "filename": "episode_1"
  }'

# Response: SRT & VTT files generated
# Files saved to: /output/episode_1.srt, /output/episode_1.vtt
```

### Step 5: Generate YouTube Metadata ✨ NEW
```bash
curl -X POST http://localhost:3000/api/metadata/youtube \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Interesting Facts About Animals",
    "topic": "Animal Facts",
    "summary": "Learn amazing facts about creatures",
    "narrationPoints": [
      "Gajah bisa menangis",
      "Burung kolibri berdetak jantung 1000x/menit"
    ],
    "keywords": ["animals", "facts", "education"]
  }'

# Response: 5 title variations, description, hashtags, tags
```

### Step 6: Get Background Music ✨ NEW
```bash
# Option A: Auto-detect mood from narration
curl -X POST http://localhost:3000/api/bgm/analyze-mood \
  -H "Content-Type: application/json" \
  -d '{"text": "Your amazing narration text"}'

# Response: detected mood (upbeat, calm, dramatic, etc)

# Option B: Get music for specific mood
curl -X POST http://localhost:3000/api/bgm/get-by-mood \
  -H "Content-Type: application/json" \
  -d '{"mood": "upbeat"}'

# Response: Music downloaded to /output/bgm_upbeat_*.mp3
```

### Step 7: Generate Final Video (Existing)
```bash
# Use form-data with video config
curl -X POST http://localhost:3000/api/generate \
  -F "bgm_audio=@/path/to/bgm.mp3" \
  -F "payload='{"resolution":"9:16","storyTitle":"My Video","slides":[...]}"'

# Response: /output/video_*.mp4 ready for YouTube!
```

---

## 📊 API Quick Reference

### Subtitles Service
```javascript
// Generate SRT & VTT
POST /api/subtitles/generate
Input:  { text, duration?, filename? }
Output: { srtPath, vttPath, vttUrl, subtitles, json }

// Download subtitle file
GET /api/subtitles/download/srt/filename
GET /api/subtitles/download/vtt/filename
```

### YouTube Metadata Service
```javascript
// Generate all metadata
POST /api/metadata/youtube
Input:  { title, topic, summary?, narrationPoints?, keywords? }
Output: { metadata: { titles, description, hashtags, tags } }
```

### Background Music Service
```javascript
// Get available services
GET /api/bgm/services
Output: { services: { pexels, pixabay, freepd, ... } }

// Analyze text for mood
POST /api/bgm/analyze-mood
Input:  { text }
Output: { mood }

// Get music for mood
POST /api/bgm/get-by-mood
Input:  { mood }
Output: { music: { path, url, duration } }
```

---

## 🎵 Music Moods Available

Choose from:
- **upbeat** - Energetic, happy, fast-paced
- **calm** - Relaxing, peaceful, meditative  
- **dramatic** - Intense, suspenseful, powerful
- **cinematic** - Epic, grand, impressive
- **corporate** - Professional, formal
- **chill** - Lo-fi, ambient, relaxed
- **motivational** - Inspiring, uplifting
- **dark** - Mysterious, eerie, suspenseful

---

## 📝 Voice Options Available

- **shimmer** 🎀 - Soft female (default, best for narration)
- **nova** ✨ - Bright female (energetic)
- **alloy** 🎤 - Neutral female (balanced)
- **fable** 🎧 - Warm male (storytelling)
- **onyx** 🎺 - Deep male (professional)

---

## 🎥 Output Files After Generation

```
/output/
├── video_*.mp4              ← Main video file
├── episode_1.srt            ← Subtitles (SubRip format)
├── episode_1.vtt            ← Subtitles (WebVTT format)
├── bgm_upbeat_*.mp3         ← Background music
└── narration.mp3            ← Voice narration
```

---

## ✅ YouTube Upload Checklist

After generating video:

- [ ] Video MP4: `/output/video_*.mp4`
- [ ] Subtitles: `/output/episode_*.srt` (upload to YT)
- [ ] Title: Use one of 5 generated variations
- [ ] Description: Copy from metadata endpoint
- [ ] Hashtags: First 15 from metadata (#hashtag1 #hashtag2...)
- [ ] Tags: Use all 20 tags from metadata
- [ ] Thumbnail: (TODO - generate separately)
- [ ] Resolution: Check video matches selected ratio (9:16, 16:9, 1:1)

---

## 🔧 Environment Variables

```env
# Required (existing)
OPENAI_API_KEY=sk_...

# Required for subtitle & metadata generation
# (Already in .env for OpenAI)

# Optional (for music autocomplete)
PEXELS_API_KEY=your_free_key_from_pexels.com/api

# Optional (for future YouTube upload)
YOUTUBE_API_KEY=...
YOUTUBE_EMAIL=...
YOUTUBE_PASSWORD=...
```

---

## 🐛 Troubleshooting

### "Text diperlukan" error
```
✅ Always provide 'text' parameter in request body
```

### "API key diperlukan" error
```
✅ Add OPENAI_API_KEY to .env
✅ Restart server after adding key
```

### Music download fails
```
✅ Add PEXELS_API_KEY to .env (get free at pexels.com/api)
✅ Fallback: Use manually uploaded BGM (not auto)
```

### Subtitle timing wrong
```
✅ Provide 'duration' parameter for better accuracy
✅ Timing auto-calculated if duration not provided
```

---

## 📈 Performance Tips

1. **Parallel Requests**: Generate subtitles + metadata simultaneously
2. **Batch Processing**: Queue multiple videos (TODO feature)
3. **Caching**: Store frequently used backgrounds/music
4. **Compression**: Use MP4 preset "fast" for quicker encoding
5. **Async Uploads**: Don't wait for upload to finish

---

## 🎯 Example: Complete Flow

```javascript
// 1. Generate narration
const narration = await fetch('/api/narration/generate', {...})
const text = narration.ideas[0].narrationSegments[0]

// 2. Generate audio
const audio = await fetch('/api/tts/generate', {text, voice: 'shimmer'})

// 3. Generate subtitles (NEW)
const subs = await fetch('/api/subtitles/generate', {text, duration: 30})
console.log(subs.vttUrl) // Ready for YouTube

// 4. Generate metadata (NEW)
const meta = await fetch('/api/metadata/youtube', {title, topic, ...})
console.log(meta.metadata.hashtags) // Copy to YouTube

// 5. Get music (NEW)
const mood = await fetch('/api/bgm/analyze-mood', {text})
const music = await fetch('/api/bgm/get-by-mood', {mood: mood.mood})
console.log(music.music.path) // Add to video

// 6. Generate video
const video = await fetch('/api/generate', {...formData...})
console.log(video.videoUrl) // Upload to YouTube!
```

---

## 📞 Support Resources

- **Complete API Docs**: See `YOUTUBE_FEATURES_ADDED.md`
- **Implementation Summary**: See `YOUTUBE_ENHANCEMENT_SUMMARY.md`
- **Before/After**: See `BEFORE_AFTER_COMPARISON.md`
- **Server Logs**: Check console for detailed errors
- **Test Reports**: See `TEST_REPORT.md`

---

**Version**: 1.1 (Enhanced for YouTube)  
**Last Updated**: April 8, 2026  
**Status**: ✅ Production Ready
