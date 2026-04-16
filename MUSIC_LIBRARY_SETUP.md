# 🎵 Local Music Library Setup Guide

## Overview
The app now prefers **local music library** over Pexels API. This ensures reliable, high-quality royalty-free music across different moods.

## Quick Setup

### Option 1: Automatic Download (Pixabay API) ⭐ Recommended

1. **Get Pixabay API Key (FREE)**
   - Visit: https://pixabay.com/api/docs/
   - Sign up / Login
   - Copy your API key from the dashboard

2. **Add to `.env`**
   ```
   PIXABAY_API_KEY=your_api_key_here
   ```

3. **Run Download Script**
   ```bash
   node download-music-library.js
   ```
   This will download ~24 royalty-free music files organized by mood.

4. **Restart Server**
   ```bash
   node server.js
   ```

### Option 2: Manual Download (YouTube Audio Library)

1. **Download Music**
   - Go to: https://www.youtube.com/audiolibrary/
   - Search for music by mood:
     - Upbeat, Calm, Dramatic, Cinematic, Corporate, Chill, Motivational, Dark

2. **Organize Files**
   ```
   services/music-library/
   ├── upbeat/           (place upbeat music here)
   ├── calm/             (place calm music here)
   ├── dramatic/
   ├── cinematic/
   ├── corporate/
   ├── chill/
   ├── motivational/
   └── dark/
   ```

3. **Add Music Files**
   - Download MP3/WAV files for each mood
   - Place in corresponding folder
   - Supported formats: `.mp3`, `.wav`, `.aac`, `.m4a`

## File Structure Expected
```
services/music-library/
├── upbeat/
│   ├── upbeat_1_12345.mp4
│   ├── upbeat_2_67890.mp4
│   └── upbeat_3_11111.mp4
├── calm/
│   ├── calm_1_99999.mp4
│   ├── calm_2_88888.mp4
│   └── calm_3_77777.mp4
└── ... (other moods)
```

## How It Works

**Priority Order:**
1. ✅ Check local music library → Use if available
2. ✅ Fall back to Pexels API → Download if local not found
3. ✅ Continue without music → If both fail (video still generates)

**When Generating Videos:**
```
User selects mood "calm" 
→ Check services/music-library/calm/ 
→ Pick random file if exists 
→ Use it directly (no download needed)
→ Much faster! ⚡
```

## Benefits

✅ **Faster** - No API calls needed for local files  
✅ **Reliable** - Always has music ready  
✅ **Diverse** - Multiple music files per mood  
✅ **Fallback** - Still works with API if needed  
✅ **No License Issues** - Royalty-free from trusted sources  

## Troubleshooting

### Music still not appearing?
```bash
# Check folder contents
dir services/music-library/

# Verify music format
ffprobe services/music-library/calm/calm_1_12345.mp4
```

### Want different music?
1. Clear `services/music-library/`
2. Re-run download script
3. Or manually add different files

### Download script failed?
```bash
# Check Pixabay API key
echo $env:PIXABAY_API_KEY

# Rerun with debugging
node download-music-library.js 2>&1
```

## Supported Moods

| Mood | Use Case |
|------|----------|
| 🎵 **upbeat** | Happy, energetic, fun content |
| 😌 **calm** | Relaxing, peaceful, meditative |
| 🎬 **dramatic** | Intense, powerful, suspenseful |
| 🎥 **cinematic** | Epic, grand, orchestral |
| 💼 **corporate** | Professional, business, jazzy |
| ❄️ **chill** | Lo-fi, ambient, lounge |
| 🚀 **motivational** | Inspiring, uplifting, epic |
| 🌙 **dark** | Creepy, mysterious, horror |

## Next Steps

1. Choose setup option (1 or 2)
2. Download music files
3. Verify folder structure
4. Restart server
5. Create videos - music will auto-select! 🎥

---

**Questions?** Check the video generation logs for which music file was used.
