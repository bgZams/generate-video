const fs = require('fs');
const path = require('path');
const axios = require('axios');

const queuePath = path.join(__dirname, 'data/master_queue.json');

async function processMaster() {
    let queue = [];
    if (fs.existsSync(queuePath)) {
        queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
    }

    const pendingItem = queue.find(i => i.status === 'pending');
    if (!pendingItem) {
        console.log("No pending tasks in queue.");
        return;
    }

    console.log(`Processing command: ${pendingItem.command}`);

    // Generate 3 deeply touching Islamic motivation scripts
    // Scheduled for May 9, 10, 11 at 5:00 AM local time

    // Create Date objects for 9, 10, 11
    const createDate = (day) => {
        let d = new Date();
        d.setFullYear(2026, 4, day); // Month is 0-indexed (4 = May)
        d.setHours(5, 0, 0, 0);
        return d.toISOString();
    };

    const items = [
      {
        title: "Menangislah, Allah Mendengarmu Malam Ini",
        topic: "Motivasi Islam Menyentuh Hati",
        publishAt: createDate(9),
        narrationSegments: [
          "Bolehkah aku jujur? Kadang pura-pura kuat itu sangat melelahkan.",
          "Kamu tersenyum di depan orang lain, tapi hatimu hancur berkeping-keping saat sendirian di kamar.",
          "Kamu merasa tidak ada satu pun manusia yang mengerti perihnya lukamu.",
          "Tapi ingatlah satu hal ini: Allah selalu melihat air matamu yang jatuh dalam diam.",
          "Dia mendengar rintihan hatimu yang tak mampu diucapkan oleh bibirmu.",
          "Dalam Al-Quran, Allah berfirman: 'Dan Kami lebih dekat kepadanya daripada urat lehernya.'",
          "Malam ini, jangan lagi menahan tangismu. Hamparkan sajadahmu, bersujudlah.",
          "Menangislah sepuasnya di hadapan Allah. Ceritakan semua lelahmu pada-Nya.",
          "Dia tidak akan menertawakanmu. Dia justru sedang menyiapkan pelukan rahmat-Nya untukmu."
        ]
      },
      {
        title: "Pesan Untukmu yang Sedang Berada di Titik Terendah",
        topic: "Motivasi Islam Menyentuh Hati",
        publishAt: createDate(10),
        narrationSegments: [
          "Video ini hadir di berandamu bukan karena kebetulan. Ini pesan dari langit untukmu.",
          "Untukmu yang sedang merasa gagal, merasa tertinggal, dan merasa hidup ini tidak adil.",
          "Tarik napas panjang... dan dengarkan baik-baik.",
          "Keterpurukanmu saat ini bukanlah akhir dari kisahmu. Ini hanyalah satu babak ujian.",
          "Ulat harus masuk ke dalam kepompong yang gelap dan sempit sebelum menjadi kupu-kupu yang indah.",
          "Begitu pula denganmu. Allah sedang membentukmu di tempat yang sunyi dan menyakitkan ini.",
          "Kenapa? Karena Allah ingin kamu menjadi pribadi yang jauh lebih kuat dan lebih bersyukur nanti.",
          "Jangan menyerah sekarang. Jika Allah bisa mengubah malam menjadi siang, Dia pasti bisa mengubah kesedihanmu menjadi kebahagiaan.",
          "Simpan video ini, dan tonton lagi setiap kali dadamu terasa sesak."
        ]
      },
      {
        title: "Maafkan Dirimu Sendiri, Allah Maha Pengampun",
        topic: "Motivasi Islam Menyentuh Hati",
        publishAt: createDate(11),
        narrationSegments: [
          "Berhentilah menyiksa dirimu dengan rasa bersalah di masa lalu.",
          "Setiap malam kamu tidak bisa tidur karena dihantui penyesalan atas dosa yang pernah kamu lakukan.",
          "Kamu merasa dirimu terlalu kotor, terlalu hina untuk pantas menerima ampunan Allah.",
          "Tahukah kamu? Setan paling suka melihatmu berputus asa dari rahmat Allah.",
          "Demi Allah, rahmat dan ampunan-Nya jauh, jauh lebih luas daripada lautan dosamu.",
          "Rasulullah SAW bersabda, 'Setiap anak Adam pasti pernah berbuat salah, dan sebaik-baik orang yang bersalah adalah yang bertaubat.'",
          "Hari ini, berhentilah menghakimi dirimu sendiri. Jika Sang Pencipta saja mau memaafkanmu, kenapa kamu tidak?",
          "Melangkahlah kembali ke pelukan-Nya. Pintu taubat tidak pernah terkunci untukmu.",
          "Bagikan pesan ini untuk saudara kita yang sedang berjuang melawan rasa bersalahnya."
        ]
      }
    ];

    try {
        await axios.post('http://localhost:3000/api/automation/bulk-run', {
            voice: 'edge-id-ardi', // Warm and touching male voice
            speed: 0.85, // Slower pace for emotional delivery
            bgmMood: 'calm',
            visualEffect: 'cinematic',
            vignette: true,
            platforms: { youtube: true, facebook: true, tiktok: true },
            items: items
        });

        // Mark as completed
        pendingItem.status = 'completed';
        pendingItem.response = 'Saya (Claude) telah merampungkan 3 naskah super emosional dan menyentuh hati. Video akan tayang berurutan tanggal 9, 10, dan 11 Mei jam 05:00 WIB!';
        pendingItem.actionLogs = [
            `Menulis 3 narasi deep-talk bertema "Motivasi Islam Menyentuh Hati".`,
            `Mengatur penjadwalan presisi: 9 Mei 05:00, 10 Mei 05:00, dan 11 Mei 05:00.`,
            `Menggunakan suara "Ardi" dengan speed 0.85 (lebih pelan & dramatis).`,
            `Server sedang merender video Anda sekarang.`
        ];

        fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
        console.log("Successfully processed the new request.");
    } catch (err) {
        console.error("Error triggering backend:", err.message);
    }
}

processMaster();