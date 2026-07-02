const axios = require('axios');
const fs = require('fs');
const path = require('path');

const queuePath = path.join(__dirname, 'data/master_queue.json');

async function processSuksesVideos() {
    const items = [
      {
        title: "Stop Cari Motivasi, Ini Rahasia Sukses Tanpa Niat!",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-27T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Stop cari motivasi harian jika kamu tidak ingin selamanya jalan di tempat.",
          "Faktanya, motivasi hanyalah emosi sesaat yang diproduksi oleh dopamin instan.",
          "Orang sukses tidak bergantung pada mood, melainkan pada sistem kerja yang konsisten.",
          "Banyak orang sukses melakukan ini: membangun rutinitas otomatis tanpa perlu berpikir dua kali.",
          "Inilah alasan ilmiahnya, otak manusia dirancang untuk menghemat energi, bukan untuk terus bersemangat.",
          "Ketika kamu memaksa dirimu bergerak tanpa menunggu niat, otakmu pasti akan langsung menyesuaikan diri.",
          "Disiplin yang dingin selalu mengalahkan semangat yang membara namun tidak konsisten.",
          "Mulai hari ini, kendalikan tindakanmu secara sadar, bukan dikendalikan oleh perasaanmu.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      },
      {
        title: "Bahaya Berpikir Positif! Ini Cara Otak Menipumu",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-27T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Stop berpikir positif tanpa tindakan jika kamu tidak ingin impianmu mati sia-sia.",
          "Data menunjukkan, visualisasi berlebih tanpa aksi nyata justru menurunkan energi fisikmu secara drastis.",
          "Otakmu sangat mudah tertipu dan menganggap fantasi suksesmu sudah menjadi kenyataan.",
          "Akibatnya, kamu kehilangan dorongan biologis untuk berjuang dan menghadapi hambatan nyata.",
          "Banyak orang sukses melakukan hal sebaliknya: mereka fokus pada penyelesaian masalah, bukan hanya bermimpi indah.",
          "Inilah alasan ilmiahnya, mental kontras memaksa otak bersiap menghadapi rintangan nyata dengan taktik matang.",
          "Hadapi kenyataan pahit hari ini dengan strategi nyata yang terbukti menghasilkan perubahan.",
          "Ubah khayalan menjadi rencana kerja taktis yang wajib kamu eksekusi setiap detik.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      },
      {
        title: "Rahasia Otak Triliuner: Mengapa Pintar Saja Gak Cukup?",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-28T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Akhirnya terungkap, kepintaran akademik yang luar biasa terbukti tidak menjamin kesuksesan finansialmu.",
          "Faktanya, sekolah mengajarkanmu untuk menghindari kesalahan, padahal kesalahan adalah guru terbaik menuju kekayaan.",
          "Banyak orang sukses melakukan hal sebaliknya: mereka berani mengambil risiko terukur dan belajar dari kegagalan.",
          "Data menunjukkan bahwa daya tahan menghadapi tekanan jauh lebih menentukan kesuksesan dibanding nilai rapormu.",
          "Inilah alasan ilmiahnya, ketangguhan emosional mengaktifkan korteks prefrontal untuk mengambil keputusan logis saat krisis.",
          "Orang dengan mental pemenang selalu melihat masalah sebagai peluang baru yang menghasilkan uang.",
          "Mulai detik ini, latih mentalmu untuk menjadi baja yang tidak goyah oleh badai ujian.",
          "Sukses sejati pasti menjadi milik mereka yang terus bangkit meski telah jatuh berkali-kali.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      },
      {
        title: "Stop Jadi Orang Baik! Ini Alasan Kamu Dimanfaatkan Terus",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-28T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Stop berkata 'ya' pada semua orang jika kamu tidak ingin hidupmu berakhir menyedihkan.",
          "Faktanya, sikap selalu ingin menyenangkan orang lain hanya akan menghabiskan waktu berhargamu demi mimpi mereka.",
          "Banyak orang sukses melakukan ini: mereka menetapkan batasan yang sangat tegas untuk melindungi fokusnya.",
          "Inilah alasan ilmiahnya, energi mentalmu sangat terbatas dan harus dialokasikan hanya untuk prioritas utama.",
          "Ketika kamu berani menolak hal tidak penting, kamu pasti sedang menyelamatkan masa depanmu sendiri.",
          "Sukses sejati menuntut keberanian untuk fokus pada keahlian spesifik yang menghasilkan dampak besar.",
          "Jangan biarkan opini orang lain mendikte ke mana arah hidupmu harus melangkah hari ini.",
          "Jadilah nahkoda atas kapalmu sendiri dengan keputusan tegas yang tidak bisa diganggu gugat.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      },
      {
        title: "Bahaya Kebiasaan Ini: Mengapa Belajar Terus Bikin Kamu Miskin",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-29T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Stop menimbun buku dan seminar jika kamu tidak pernah mempraktikkan satu baris pun.",
          "Faktanya, ilusi belajar terus-menerus tanpa aksi nyata hanyalah cara otak menghindari rasa takut gagal.",
          "Banyak orang sukses melakukan ini: mereka langsung mengeksekusi ide setelah mengetahui dasar teorinya saja.",
          "Data menunjukkan bahwa kegagalan praktis memberikan pembelajaran sepuluh kali lebih cepat dibanding membaca teori.",
          "Inilah alasan ilmiahnya, pengalaman langsung membentuk jalur saraf baru di otak yang mempercepat keahlianmu.",
          "Berhentilah menunggu sampai kamu merasa siap, karena kesiapan sejati terbentuk di tengah medan pertempuran.",
          "Ambil tindakan nyata hari ini walau sekecil apa pun langkah awal yang kamu buat.",
          "Keberanian memulai pasti akan membuka pintu-pintu peluang baru yang tidak pernah kamu duga sebelumnya.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      },
      {
        title: "Rahasia Mental Juara: Cara Menghapus Keraguan dalam 3 Detik",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-29T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Rahasia menghentikan keraguan diri dalam hitungan detik akhirnya terbongkar hari ini untukmu.",
          "Faktanya, suara batin yang meragukan kemampuanmu hanyalah mekanisme pertahanan otak terhadap hal baru.",
          "Banyak orang sukses melakukan trik ini: mereka langsung bertindak sebelum otak sempat menciptakan rasa takut.",
          "Inilah alasan ilmiahnya, menunda aksi memberi waktu bagi amigdala untuk memperbesar kecemasan fiktif di kepalamu.",
          "Ketika kamu langsung bergerak, otakmu terpaksa beralih fokus pada penyelesaian tugas secara taktis.",
          "Kamu pasti memiliki kapasitas yang jauh lebih besar dari apa yang saat ini kamu yakini.",
          "Singkirkan semua skenario buruk dan fokuslah pada kemenangan kecil yang bisa kamu raih hari ini.",
          "Langkah pertama yang berani pasti akan meruntuhkan tembok keraguan yang memenjarakan potensimu selama ini.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      },
      {
        title: "Akhirnya Terungkap: Alasan Orang Sukses Sengaja Cari Musuh",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-30T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Akhirnya terungkap, mengapa orang sukses tidak pernah takut dibenci bahkan sengaja menciptakan kompetisi yang ketat.",
          "Faktanya, kritik keras dari musuh adalah umpan balik paling jujur untuk meningkatkan kualitas dirimu.",
          "Banyak orang sukses melakukan ini: memanfaatkan energi negatif para pembenci menjadi bahan bakar pembuktian diri.",
          "Inilah alasan ilmiahnya, tantangan eksternal memicu lonjakan adrenalin yang meningkatkan fokus dan daya juangmu.",
          "Jika kamu disukai semua orang, itu pertanda kamu terlalu biasa dan tidak membawa perubahan berarti.",
          "Jadikan keraguan orang lain sebagai kompas penunjuk jalan bahwa kamu sedang melangkah ke arah yang benar.",
          "Buktikan kualitas dirimu lewat karya nyata yang membungkam semua keraguan mereka tanpa banyak bicara.",
          "Setiap hantaman ujian pasti akan membuat mental pemenangmu tumbuh semakin kokoh dan tak terkalahkan.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      },
      {
        title: "Stop Curhat Masalahmu! Ini Alasan Sukses Butuh Keheningan",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-30T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Stop menceritakan masalah dan mimpimu kepada semua orang jika tidak ingin rencana itu hancur.",
          "Faktanya, curhat berlebihan hanya akan mengurangi tekanan psikologis yang seharusnya kamu gunakan untuk mencari solusi.",
          "Banyak orang sukses melakukan ini: mereka bekerja dalam kesunyian total dan membiarkan hasilnya yang bersuara.",
          "Inilah alasan ilmiahnya, validasi sosial yang terlalu dini membuat otak merasa tugas tersebut sudah selesai dikerjakan.",
          "Simpan energimu rapat-rapat dan salurkan seluruh fokusmu hanya pada proses eksekusi yang nyata.",
          "Keheningan mental memberimu ruang jernih untuk merancang strategi perang terbaik tanpa gangguan opini luar.",
          "Pastikan setiap langkahmu terukur, senyap, namun memberikan dampak kehancuran yang mutlak bagi kemiskinanmu.",
          "Hasil yang spektakuler pasti lahir dari konsistensi perjuangan sunyi yang tidak butuh tepuk tangan penonton.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      },
      {
        title: "Bahaya Mental Korban: Berhenti Salahkan Takdir dan Mulai Kaya",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-31T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Stop menyalahkan keadaan, orang tua, atau pemerintah jika kamu ingin hidupmu berubah drastis.",
          "Faktanya, mengadopsi mental korban hanya akan merampas kekuatanmu untuk mengendalikan masa depanmu sendiri.",
          "Banyak orang sukses melakukan ini: mereka mengambil tanggung jawab penuh atas kegagalan dan kesuksesannya sendiri.",
          "Inilah alasan ilmiahnya, locus of control internal terbukti meningkatkan motivasi intrinsik dan ketahanan mental secara signifikan.",
          "Ketika kamu berhenti mencari alasan, otakmu pasti akan langsung fokus mencari jalan keluar terbaik.",
          "Kegagalan masa lalu bukanlah vonis mati, melainkan data berharga untuk menyempurnakan strategi barumu hari ini.",
          "Kamu adalah satu-satunya arsitek yang bertanggung jawab penuh atas kemakmuran finansial keluargamu di masa depan.",
          "Ambil kendali kemudi hidupmu sekarang juga dan mulailah melangkah with keyakinan penuh seorang pemenang."
        ]
      },
      {
        title: "Rahasia Disiplin Ekstrim: Cara Melatih Otak Agar Kebal Malas",
        topic: "Motivasi Sukses",
        publishAt: new Date("2026-05-31T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Rahasia melatih otak agar kebal terhadap rasa malas akhirnya dibongkar oleh para ahli saraf.",
          "Faktanya, rasa malas hanyalah sinyal kenyamanan palsu yang ingin mempertahankan dirimu di zona aman.",
          "Banyak orang sukses melakukan ini: melatih toleransi terhadap rasa tidak nyaman melalui kebiasaan harian yang sulit.",
          "Inilah alasan ilmiahnya, neuroplastisitas otak pasti akan beradaptasi dan membuat hal berat menjadi terasa sangat ringan.",
          "Ketika kamu konsisten menaklukkan kemalasan kecil, kamu sedang membangun otot disiplin yang luar biasa kokoh.",
          "Jangan pernah tunduk pada bisikan tubuh yang lelah, karena mentalmu harus jauh lebih kuat dari fisikmu.",
          "Setiap keputusan sulit yang kamu ambil hari ini adalah investasi emas untuk kebebasan finansialmu esok hari.",
          "Disiplin baja yang kamu asah setiap hari pasti akan mengantarkanmu ke puncak rantai makanan kesuksesan.",
          "Tulis AMIN di komentar jika kamu ingin keajaiban ini terjadi padamu."
        ]
      }
    ];

    try {
        await axios.post('http://localhost:3000/api/automation/bulk-run', {
            voice: 'edge-id-ardi',
            speed: 0.85,
            bgmMood: 'sad',
            platforms: { youtube: true, facebook: true, tiktok: true },
            items: items
        });

        let queue = [];
        if (fs.existsSync(queuePath)) {
            queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
        }

        queue.push({
            id: require('crypto').randomUUID(),
            command: "Buatkan 10 video cara berpikir sukses. Jadwal: 27-31 Mei jam 05:30 & 15:30.",
            status: "completed",
            timestamp: new Date().toISOString(),
            response: "Claude telah menyusun 10 naskah motivasi sukses. Video dijadwalkan 2x sehari mulai 27 Mei 2026 menggunakan suara Ardi.",
            actionLogs: [
                "Menulis 10 naskah motivasi sukses dengan hook yang kuat.",
                "Mengatur penjadwalan 05:30 dan 15:30 mulai 27 Mei.",
                "Menggunakan suara Ardi dengan speed 0.85.",
                "Backend sedang memproses bulk render."
            ]
        });

        fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
        console.log("Successfully sent to backend and updated queue.");
    } catch (err) {
        console.error("Error triggering backend:", err.message);
    }
}

processSuksesVideos();
