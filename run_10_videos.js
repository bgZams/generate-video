const axios = require('axios');
const fs = require('fs');
const path = require('path');

const queuePath = path.join(__dirname, 'data/master_queue.json');

async function processMaster() {
    const items = [
      {
        title: "Jangan Putus Asa Dari Rahmat Allah",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-12T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Pernahkah kamu merasa dosamu terlalu banyak hingga malu untuk berdoa?",
          "Kamu merasa kotor, hina, dan berpikir Allah tidak akan pernah memaafkanmu.",
          "Berhentilah berpikir seperti itu. Sungguh, itu adalah bisikan setan yang ingin membuatmu menyerah.",
          "Allah berfirman: Hai hamba-hamba-Ku yang melampaui batas, janganlah kamu berputus asa dari rahmat Allah.",
          "Sungguh, Allah mengampuni dosa-dosa semuanya.",
          "Selama napas masih berhembus, pintu taubat selebar langit masih terbuka untukmu.",
          "Menangislah, sujudlah malam ini, dan katakan: Ya Allah, aku kembali.",
          "Jangan tunda lagi. Kembalilah sebelum waktu di dunia ini habis.",
          "Bagikan video ini kepada mereka yang sedang mencari jalan pulang, dan follow untuk pengingat lainnya."
        ]
      },
      {
        title: "Doa Ibu Adalah Kunci Surga dan Kesuksesanmu",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-12T16:00:00+07:00").toISOString(),
        narrationSegments: [
          "Kamu merasa sudah bekerja keras tapi hidup selalu sial dan penuh masalah?",
          "Coba ingat-ingat lagi, kapan terakhir kali kamu membentak ibumu?",
          "Satu tetes air mata ibu yang jatuh karena lisan kasarmu, bisa menutup pintu rezekimu di langit.",
          "Ridha Allah ada pada ridha orang tua, dan murka-Nya ada pada murka mereka.",
          "Jangan bangga dengan gajimu yang besar jika ibumu masih menangis di sepertiga malam karena sikapmu.",
          "Pulanglah, peluk ibumu, cium tangannya, dan mintalah maaf sebelum semuanya terlambat.",
          "Karena jika bumi sudah menutupi wajahnya, penyesalan seumur hidup tidak akan pernah cukup.",
          "Kirim video ini ke grup keluargamu, dan follow untuk renungan setiap hari."
        ]
      },
      {
        title: "Rezeki Sudah Tertakar, Tidak Akan Tertukar",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-13T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Gelisah memikirkan hari esok? Takut rezekimu diambil orang lain?",
          "Tenanglah, rezekimu sudah ditulis di Lauhul Mahfudz bahkan sebelum kamu dilahirkan.",
          "Ibarat maut yang pasti akan mencarimu, rezeki pun sedang berjalan mencarimu saat ini.",
          "Yang dituntut darimu bukanlah mencemaskan hasilnya, melainkan memaksimalkan ikhtiarnya.",
          "Tugas kita hanya berusaha dan bertawakkal, biarkan Allah yang mengatur sisanya.",
          "Jangan sampai kecemasan tentang dunia membuatmu lupa pada Sang Pemilik Dunia.",
          "Bersyukurlah atas apa yang kamu miliki hari ini, karena syukur adalah magnet rezeki yang paling kuat.",
          "Ketik Alhamdulillah jika kamu percaya pada janji Allah, dan follow channel ini."
        ]
      },
      {
        title: "Lelahmu Akan Menjadi Lillah",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-13T16:00:00+07:00").toISOString(),
        narrationSegments: [
          "Hari ini terasa sangat berat? Pekerjaan menumpuk dan badan rasanya ingin ambruk?",
          "Tarik napas dalam-dalam. Ingatlah untuk siapa kamu berjuang hari ini.",
          "Keringat yang menetes demi menafkahi keluarga adalah jihad di jalan Allah.",
          "Setiap langkah lelahmu, jika diniatkan karena Allah, akan bernilai pahala yang menggunung.",
          "Jangan menyerah dulu. Allah tahu kamu sedang berjuang, Allah melihat setiap tetes keringatmu.",
          "Beristirahatlah sejenak jika lelah, tapi jangan pernah berpikir untuk berhenti melangkah.",
          "Jadikan lelahmu sebagai Lillah, maka beban di pundakmu akan terasa lebih ringan.",
          "Simpan video ini untuk penyemangat di kala lelah, dan follow untuk energi positif setiap hari."
        ]
      },
      {
        title: "Titik Balik: Saatnya Kembali kepada Sang Pencipta",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-14T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Apakah kamu merasa hidupmu hampa meskipun semua keinginan duniawimu terpenuhi?",
          "Itu adalah tanda bahwa hatimu merindukan pemilik aslinya, yaitu Allah.",
          "Dunia ini menipu. Semakin dikejar, ia semakin membuat kita merasa haus dan kosong.",
          "Mungkin sudah terlalu jauh kamu melangkah meninggalkan sajadahmu.",
          "Tapi tahukah kamu? Allah sangat gembira melihat hamba-Nya yang bertaubat, lebih dari musafir yang menemukan air di gurun pasir.",
          "Tidak ada kata terlambat. Walau dosamu sebanyak buih di lautan, ampunan-Nya seluas semesta.",
          "Ambillah air wudhu, bersihkan dirimu, dan berbisiklah di atas bumi agar didengar oleh langit.",
          "Tag teman hijrahmu, dan follow channel ini untuk menemani proses perubahanmu."
        ]
      },
      {
        title: "Penyesalan Terbesar Seorang Anak",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-14T16:00:00+07:00").toISOString(),
        narrationSegments: [
          "Pernahkah kamu membiarkan telepon dari ayah atau ibumu tidak terjawab karena sibuk dengan teman-teman?",
          "Kita sering kali memberikan sisa waktu kita untuk mereka yang telah memberikan seluruh hidupnya untuk kita.",
          "Ingatlah, usia mereka tidak bertambah muda. Waktu yang kamu miliki bersama mereka semakin menipis.",
          "Jangan sampai, tangisan keras di dekat pusara menjadi satu-satunya cara kamu meminta maaf.",
          "Hargai keberadaan mereka saat masih bisa disentuh, diajak bicara, dan dimintai doa.",
          "Satu doa dari lisan mereka bisa menembus langit tujuh lapis tanpa penghalang.",
          "Telepon orang tuamu hari ini, ucapkan bahwa kamu menyayangi mereka.",
          "Klik like jika kamu menyayangi orang tuamu, dan follow untuk renungan hati lainnya."
        ]
      },
      {
        title: "Sedekah Tidak Akan Membuatmu Miskin",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-15T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Takut miskin karena berbagi? Itu adalah tipu daya setan yang sangat nyata.",
          "Logika manusia berkata: berbagi berarti mengurangi apa yang kita miliki.",
          "Tapi matematika Allah berbeda: berbagi adalah cara melipatgandakan apa yang kita miliki.",
          "Perumpamaan orang yang menginfakkan hartanya di jalan Allah adalah seperti sebutir biji yang menumbuhkan tujuh tangkai.",
          "Sedekah tidak hanya menolak bala, tapi juga mengundang malaikat untuk mendoakan kelapangan rezekimu.",
          "Sisihkanlah sedikit dari hartamu hari ini, tidak peduli seberapa kecil jumlahnya.",
          "Karena yang Allah nilai bukanlah nominalnya, melainkan keikhlasan hatinya.",
          "Bagikan pesan kebaikan ini ke teman-temanmu, dan jangan lupa follow."
        ]
      },
      {
        title: "Sukses Membutuhkan Sabar dan Doa",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-15T16:00:00+07:00").toISOString(),
        narrationSegments: [
          "Kamu merasa sudah berdoa setiap hari, tapi doa itu belum juga dikabulkan?",
          "Pahami satu hal: Allah menunda bukan berarti menolak.",
          "Allah tahu waktu yang paling tepat untuk mengabulkan permintaanmu, jauh lebih baik dari yang kamu tahu.",
          "Teruslah berusaha tanpa henti, dan teruslah berdoa tanpa lelah.",
          "Doa tanpa usaha adalah kebohongan, dan usaha tanpa doa adalah kesombongan.",
          "Jadilah pribadi yang tangguh di bumi dan merendah di hadapan Sang Ilahi.",
          "Saat waktunya tiba, Allah akan memberikan sesuatu yang akan membuatmu tersenyum puas.",
          "Simpan video ini agar kamu tetap semangat, dan follow untuk inspirasi harianmu."
        ]
      },
      {
        title: "Istighfar: Kunci Pembuka Segala Pintu Tertutup",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-16T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Sedang terjepit hutang? Susah dapat keturunan? Atau merasa hidup serba buntu?",
          "Ada satu amalan ringan di lisan tapi luar biasa dampaknya untuk mengubah keadaanmu.",
          "Amalan itu adalah memperbanyak Istighfar setiap saat, di manapun kamu berada.",
          "Barangsiapa memperbanyak istighfar, niscaya Allah memberikan jalan keluar bagi setiap kesedihannya.",
          "Istighfar mencabut akar dosa yang selama ini menjadi penghalang turunnya rezekimu.",
          "Jadikan istighfar sebagai zikir rutinan di sela-sela kesibukanmu.",
          "Astaghfirullahal 'adzim. Ucapkan sekarang dari lubuk hatimu yang terdalam.",
          "Kirim video ini agar semakin banyak yang beristighfar, dan follow channel ini."
        ]
      },
      {
        title: "Tawakkal Setelah Ikhtiar Maksimal",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-16T16:00:00+07:00").toISOString(),
        narrationSegments: [
          "Kamu sudah mencoba segalanya, melamar ke puluhan tempat, membangun bisnis tapi gagal?",
          "Jangan biarkan kegagalan membuatmu berburuk sangka kepada rencana Allah.",
          "Bisa jadi, Allah sedang menyelamatkanmu dari sesuatu yang buruk menurut ilmu-Nya.",
          "Tugasmu bukanlah memastikan keberhasilan, tapi memastikan bahwa usahamu sudah maksimal.",
          "Setelah itu, serahkan segalanya kepada Sang Pengatur Skenario Terbaik.",
          "Orang yang bertawakkal tidak akan pernah stres karena dia tahu hidupnya diurus oleh Zat Yang Maha Sempurna.",
          "Lepaskan beban di hatimu, yakini bahwa esok akan lebih baik atas izin-Nya.",
          "Ketik Aamiin untuk mendoakan masa depanmu yang cerah, dan follow untuk motivasi kehidupan."
        ]
      }
    ];

    try {
        await axios.post('http://localhost:3000/api/automation/bulk-run', {
            voice: 'edge-id-ardi',
            speed: 0.85, // Lebih dramatis dan menyentuh hati
            bgmMood: 'sad', // Musik sedih/menyentuh
            visualEffect: 'none',
            vignette: true,
            platforms: { youtube: true, facebook: true, tiktok: true },
            items: items
        });

        // Add to UI queue list
        let queue = [];
        if (fs.existsSync(queuePath)) {
            queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
        }

        queue.push({
            id: require('crypto').randomUUID(),
            command: "Buatkan 10 video motivasi islam tentang bertaubat, durhaka, rezeki dan usaha. Jadwal: 12-16 Mei jam 05:30 dan 16:00.",
            status: "completed",
            timestamp: new Date().toISOString(),
            response: "Saya (Claude) telah menyusun 10 naskah motivasi Islam super emosional secara acak (Taubat, Durhaka, Rezeki, Usaha). Video dijadwalkan tayang 2x sehari (05:30 & 16:00) dari tanggal 12 hingga 16 Mei 2026.",
            actionLogs: [
                "Menulis 10 naskah deep-talk penyentuh hati.",
                "Mengatur penjadwalan presisi dari 12 s/d 16 Mei (Pagi dan Sore).",
                "Menggunakan suara Ardi dengan speed 0.85 & BGM Sad agar lebih emosional.",
                "Server sedang memproses render kesepuluh video Anda."
            ]
        });

        fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
        console.log("Successfully sent to backend and updated queue.");
    } catch (err) {
        console.error("Error triggering backend:", err.message);
    }
}

processMaster();
