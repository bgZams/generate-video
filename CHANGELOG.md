# Changelog - Infinity VidGen

## [1.0.3] - 2026-04-11
### ✨ Fitur Baru (Otomasi & YouTube)
- **Manual Scheduling**: Menambahkan fitur penjadwalan manual pada tombol "Run Automation Now". Pengguna bisa menentukan waktu publikasi YouTube sebelum video di-generate.
- **11-Slide Structure**: Menstandarisasi total slide menjadi tepat 11 slide untuk durasi YouTube Shorts yang optimal.
- **Visual Grouping Logic**: Implementasi logika pengelompokan gambar latar belakang (Slide 1-3 sama, 4-8 sama, 9-11 sama) untuk estetika yang lebih kohesif.
- **Viral Metadata Engine**: Optimasi prompt AI untuk menghasilkan judul clickbait positif, deskripsi storytelling, dan hashtag trending otomatis yang siap "FYP".

### 🛠️ Perbaikan & Optimasi
- **Hosting-Ready Structure**: Perbaikan rute dan asset loading untuk mendukung deployment di sub-folder (cPanel/Shared Hosting).
- **FFmpeg Performance**: Penambahan preset `superfast` dan pembatasan thread untuk menjaga stabilitas rendering di lingkungan dengan CPU terbatas.
- **UI/UX Enhancement**: Redesain dashboard dengan tema premium, dark mode, dan mikro-animasi.

## [1.0.0] - 2026-04-10
### 🚀 Initial Release
- Integrasi OpenAI (Narasi & Ide).
- Integrasi YouTube API v3 (Upload Otomatis).
- Sistem Rendering Video (FFmpeg).
- Scheduler (Cron Jobs).
