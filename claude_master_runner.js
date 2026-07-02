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

    // Claude generates the 6 amazing video ideas manually to bypass Gemini limits
    let now = new Date();
    now.setMinutes(now.getMinutes() + 30);

    const items = [
      {
        title: "Jangan Sedih, Ini Janji Allah Untukmu",
        topic: "Motivasi Islam",
        publishAt: new Date(now.getTime() + 0 * 2 * 60 * 60 * 1000).toISOString(),
        narrationSegments: [
          "Stop merasa sendirian! Ini rahasia langit yang harus kamu tahu hari ini.",
          "Pernahkah kamu merasa beban hidup ini terlalu berat sampai rasanya ingin menyerah?",
          "Ujian datang bertubi-tubi, rezeki terasa seret, dan orang-orang di sekitarmu seakan menjauh.",
          "Faktanya, ini bukanlah tanda Allah membencimu. Sama sekali bukan!",
          "Dalam Al-Quran surat Al-Baqarah ayat 286, Allah tegas berjanji tidak akan membebani hamba-Nya di luar kemampuannya.",
          "Ujian yang kamu hadapi detik ini adalah bukti bahwa Allah tahu kamu kuat menyelesaikannya.",
          "Dia sedang mempersiapkan derajat yang lebih tinggi untukmu di masa depan.",
          "Jadi, hapus air matamu, angkat kepalamu, dan katakan: Hasbunallah wani'mal wakil.",
          "Simpan video ini sebagai pengingat saat kamu sedang down, dan follow untuk motivasi lainnya."
        ]
      },
      {
        title: "Rahasia Rezeki Datang Tanpa Diduga",
        topic: "Motivasi Islam",
        publishAt: new Date(now.getTime() + 1 * 2 * 60 * 60 * 1000).toISOString(),
        narrationSegments: [
          "Rahasia besar! Inilah alasan kenapa rezeki bisa datang dari arah yang tidak disangka-sangka.",
          "Banyak orang mati-matian bekerja siang malam, tapi merasa rezekinya selalu kurang.",
          "Sementara ada yang kerjanya biasa saja, tapi hidupnya tenang dan rezekinya selalu mengalir.",
          "Perbedaannya ternyata bukan pada seberapa keras kita bekerja, tapi seberapa kuat rasa Tawakkal kita.",
          "Barangsiapa bertakwa kepada Allah, niscaya Dia akan membukakan jalan keluar baginya...",
          "...dan memberinya rezeki dari arah yang tiada disangka-sangkanya (At-Thalaq 2-3).",
          "Tawakkal bukan berarti diam, tapi menyerahkan hasil akhir sepenuhnya kepada Sang Pemberi Rezeki setelah berusaha.",
          "Mulai hari ini, libatkan Allah dalam setiap urusanmu, dan lihat keajaiban yang akan terjadi.",
          "Tag temanmu yang sedang mencari pekerjaan, dan follow untuk inspirasi harian."
        ]
      },
      {
        title: "Bahaya Menunda Taubat, Fakta Mengejutkan!",
        topic: "Motivasi Islam",
        publishAt: new Date(now.getTime() + 2 * 2 * 60 * 60 * 1000).toISOString(),
        narrationSegments: [
          "Hati-hati! Inilah fakta mengejutkan kenapa menunda taubat bisa menghancurkan masa depanmu.",
          "Kita sering berpikir, Ah, nanti saja taubatnya kalau sudah tua atau sudah sukses.",
          "Padahal, kita tidak pernah tahu kapan kontrak usia kita di dunia ini akan berakhir.",
          "Menunda taubat bukan hanya soal dosa yang menumpuk, tapi juga membuat hati menjadi mati dan keras.",
          "Ibnul Qayyim berkata, dosa yang dibiarkan akan melahirkan dosa-dosa baru yang lebih besar.",
          "Setiap kali kita berbuat dosa, sebuah titik hitam bersarang di hati kita.",
          "Jika tidak segera dihapus dengan istighfar, titik hitam itu akan menutupi seluruh hati.",
          "Jangan tunggu besok. Ucapkan Astaghfirullah sekarang juga, dan kembalilah kepada Allah.",
          "Klik like jika kamu ingin berubah menjadi lebih baik hari ini, dan follow channel ini."
        ]
      },
      {
        title: "Doa Paling Mustajab Saat Sujud Terakhir",
        topic: "Motivasi Islam",
        publishAt: new Date(now.getTime() + 3 * 2 * 60 * 60 * 1000).toISOString(),
        narrationSegments: [
          "Jangan lewatkan ini! Rahasia doa paling mustajab yang sering dilupakan umat muslim.",
          "Kamu punya hajat besar? Ingin segera lunas hutang, dapat jodoh, atau sembuh dari penyakit?",
          "Rasulullah SAW membocorkan satu waktu emas di mana doa kita sangat dekat dengan pengabulan.",
          "Waktu itu adalah saat kita sedang berada dalam posisi sujud kepada Allah.",
          "Keadaan seorang hamba paling dekat dengan Rabb-nya adalah ketika ia sedang sujud, maka perbanyaklah doa di dalamnya. (HR. Muslim).",
          "Dalam sujud, kita merendahkan diri serendah-rendahnya di hadapan Sang Pencipta.",
          "Ini adalah momen paling tepat untuk menumpahkan segala keluh kesah dan harapanmu.",
          "Nanti saat sholat, panjangkan sujud terakhirmu dan mintalah dengan penuh keyakinan.",
          "Bagikan video ini agar menjadi amal jariyah untukmu, dan jangan lupa follow."
        ]
      },
      {
        title: "Tanda Allah Sedang Menghapus Dosamu",
        topic: "Motivasi Islam",
        publishAt: new Date(now.getTime() + 4 * 2 * 60 * 60 * 1000).toISOString(),
        narrationSegments: [
          "Akhirnya terungkap! Inilah tanda nyata bahwa Allah sedang membersihkan dosa-dosamu.",
          "Pernahkah kamu tiba-tiba merasa sakit, kehilangan sesuatu yang berharga, atau difitnah orang?",
          "Secara manusiawi, kita pasti marah, sedih, dan merasa dunia ini tidak adil.",
          "Tapi tunggu dulu! Jangan terburu-buru menyalahkan keadaan atau takdir.",
          "Faktanya, musibah yang menimpa seorang mukmin adalah cara Allah mencucinya dari dosa.",
          "Rasulullah SAW bersabda, tidaklah seorang muslim tertimpa keletihan, penyakit, kesedihan, hingga duri yang menusuknya...",
          "...melainkan Allah akan menghapus dosa-dosanya dengan sebab itu semua.",
          "Jadi, bersabarlah! Sakitmu hari ini adalah tabungan pahalamu di akhirat kelak.",
          "Ketik Alhamdulillah di komentar sebagai bentuk syukurmu hari ini."
        ]
      },
      {
        title: "Keajaiban Sholat Tahajud 40 Hari",
        topic: "Motivasi Islam",
        publishAt: new Date(now.getTime() + 5 * 2 * 60 * 60 * 1000).toISOString(),
        narrationSegments: [
          "Berhenti mengeluh! Lakukan rutinitas malam ini dan lihat keajaiban dalam hidupmu.",
          "Banyak dari kita yang mengeluh hidupnya stagnan, doanya belum terjawab, dan hatinya gelisah.",
          "Tahukah kamu bahwa ada satu kunci rahasia yang bisa membuka pintu langit?",
          "Kunci itu adalah Sholat Tahajud di sepertiga malam terakhir.",
          "Saat semua orang tertidur lelap, Allah turun ke langit dunia dan bertanya...",
          "Siapa yang berdoa kepada-Ku, niscaya Aku kabulkan. Siapa yang meminta, niscaya Aku beri.",
          "Cobalah rutinkan Tahajud selama 40 hari berturut-turut tanpa putus.",
          "Banyak orang sukses membuktikan bahwa keajaiban dan ketenangan hidup berawal dari sajadah di malam hari.",
          "Simpan video ini sebagai tantangan untuk dirimu sendiri, dan follow untuk part selanjutnya."
        ]
      }
    ];

    // Trigger backend bulk generation using server's API so logs appear in UI
    try {
        await axios.post('http://localhost:3000/api/automation/bulk-run', {
            voice: 'edge-id-ardi', // Suara pria yang hangat dan meyakinkan
            speed: 0.9,
            bgmMood: 'calm',
            visualEffect: 'none',
            vignette: true,
            platforms: { youtube: true, facebook: true, tiktok: true },
            items: items
        });

        // Mark as completed in Queue
        pendingItem.status = 'completed';
        pendingItem.response = 'Saya (Claude) telah membuat 6 naskah motivasi Islam terbaik dengan pola retensi tinggi, dan sedang memerintahkan server Anda untuk merendernya sekarang!';
        pendingItem.actionLogs = [
            `Menulis 6 narasi emosional bertema "Motivasi Islam" secara manual (Bypass Gemini Limit).`,
            `Menggunakan suara "Ardi" (Warm Male Voice) dan BGM "Calm".`,
            `Menjadwalkan upload setiap 2 jam.`,
            `Server mulai memproses (cek Live Logs Anda di bawah ini).`
        ];

        fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
        console.log("Successfully sent to backend and updated queue.");
    } catch (err) {
        console.error("Error triggering backend:", err.message);
    }
}

processMaster();