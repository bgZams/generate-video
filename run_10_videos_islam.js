const axios = require('axios');
const fs = require('fs');
const path = require('path');

const queuePath = path.join(__dirname, 'data/master_queue.json');

async function processIslamicVideos() {
    const items = [
      {
        title: "Rahasia Rezeki yang Terus Mengalir",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-27T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Banyak orang lelah mengejar rezeki, tapi lupa mengejar Pemilik rezeki.",
          "Faktanya, rezeki itu bukan hanya soal angka di rekening, tapi ketenangan di dalam hati.",
          "Allah sudah menjamin setiap tetes keringatmu tidak akan pernah sia-sia.",
          "Rahasia keberkahan adalah dengan bersyukur saat sempit, dan bersedekah saat lapang.",
          "Pernahkah kamu merasa uang cepat habis? Mungkin ada hak orang lain yang belum kamu tunaikan.",
          "Bukalah pintu langit dengan istighfar dan shalat dhuha setiap pagi.",
          "Percayalah, jika kamu membantu urusan hamba-Nya, Allah pasti akan membantu urusanmu.",
          "Jemputlah rezeki yang halal dengan cara yang dicintai oleh Sang Pencipta.",
          "Jangan lupa subscribe channel ini untuk mendapatkan inspirasi harian yang mencerahkan jiwa."
        ]
      },
      {
        title: "Keajaiban Doa Orang Tua",
        topic: "Keluarga Islam",
        publishAt: new Date("2026-05-27T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Ridha Allah ada pada ridha orang tua, dan murka Allah ada pada murka mereka.",
          "Pernahkah kamu merasa hidupmu buntu? Cobalah cek kembali hubunganmu dengan ibu dan ayah.",
          "Doa orang tua adalah kunci sakti yang mampu menembus langit ketujuh tanpa penghalang.",
          "Setiap kesuksesan yang kamu raih hari ini, ada tetesan air mata doa ibu di dalamnya.",
          "Jangan tunggu mereka tiada baru kamu merasa kehilangan dan menyesal.",
          "Muliakanlah mereka selagi ada, karena mereka adalah pintu surga yang paling tengah.",
          "Satu senyuman tulus dari wajah orang tua adalah keberkahan terbesar dalam hidupmu.",
          "Jadikan berbakti sebagai prioritas, maka dunia akan datang bersimpuh di hadapanmu.",
          "Subscribe channel ini jika kamu ingin terus belajar mencintai keluarga karena Allah."
        ]
      },
      {
        title: "Cinta Sejati Karena Allah",
        topic: "Cinta dalam Islam",
        publishAt: new Date("2026-05-28T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Mencintai karena rupa akan pudar, mencintai karena harta akan sirna.",
          "Tapi mencintai karena Allah adalah ikatan suci yang akan abadi hingga ke surga.",
          "Cinta dalam Islam bukan tentang siapa yang paling cepat, tapi siapa yang paling taat.",
          "Jangan biarkan perasaanmu menjerumuskanmu ke dalam murka Sang Khalik.",
          "Jagalah kesucian hatimu untuk seseorang yang namanya sudah tertulis di Lauhul Mahfudz.",
          "Cinta terbaik adalah yang saling mendekatkan diri kepada ketaatan, bukan kemaksiatan.",
          "Saling memaafkan dan saling mendoakan adalah bumbu terbaik dalam rumah tangga Islami.",
          "Biarlah Allah yang menjadi saksi atas setiap pengorbanan cintamu yang tulus.",
          "Ayo subscribe channel ini untuk tips membangun cinta yang berkah dan penuh ketenangan."
        ]
      },
      {
        title: "Mencari Berkah dalam Setiap Langkah",
        topic: "Keberkahan",
        publishAt: new Date("2026-05-28T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Banyak itu belum tentu berkah, tapi berkah itu pasti akan terasa cukup.",
          "Keberkahan adalah ketika hartamu membuatmu semakin dekat kepada Allah.",
          "Mulailah harimu dengan bismillah, agar setiap langkahmu dijaga oleh para malaikat.",
          "Keberkahan seringkali hadir dalam kesederhanaan yang dibungkus dengan rasa syukur.",
          "Hindarilah harta yang syubhat, karena setitik haram bisa menghapus ribuan kebaikan.",
          "Jadilah hamba yang menebar manfaat, karena sebaik-baik manusia adalah yang paling bermanfaat.",
          "Keberkahan bukan tentang apa yang kita miliki, tapi tentang apa yang bisa kita beri.",
          "Semoga hari-harimu selalu dinaungi oleh rahmat dan kasih sayang-Nya yang luas.",
          "Jangan lupa subscribe channel ini untuk selalu mendapatkan pengingat tentang iman."
        ]
      },
      {
        title: "Sabar Adalah Kekuatan Tanpa Batas",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-29T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Allah tidak menjanjikan langit selalu biru, tapi Allah menjanjikan pertolongan bagi yang sabar.",
          "Sabar bukan berarti menyerah, tapi sabar adalah bertahan dalam ketaatan saat ujian menerjang.",
          "Ingatlah, setelah kesulitan pasti ada kemudahan. Itu adalah janji Allah yang pasti.",
          "Jangan biarkan lisanmu mengeluh, biarkan hatimu terus berdzikir menyebut nama-Nya.",
          "Ujian adalah cara Allah merindukan rintihan doamu di sepertiga malam terakhir.",
          "Jadilah seperti batu karang yang tetap kokoh meski dihantam ombak cobaan yang dahsyat.",
          "Setiap rasa sakit yang kamu rasakan hari ini adalah penggugur dosa-dosamu di masa lalu.",
          "Teruslah melangkah dengan husnudzon, karena rencana Allah jauh lebih indah dari mimpimu.",
          "Silakan subscribe channel ini agar kita bisa saling menguatkan dalam perjalanan iman."
        ]
      },
      {
        title: "Rumah Tangga Surga di Dunia",
        topic: "Keluarga Islam",
        publishAt: new Date("2026-05-29T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Rumah yang berkah adalah rumah yang di dalamnya selalu terdengar lantunan ayat suci Al-Qur'an.",
          "Jadikan pasanganmu sebagai teman perjalanan menuju Jannah, bukan sekadar teman hidup.",
          "Kelembutan kata-kata dan ketulusan pelayanan adalah kunci keharmonisan keluarga.",
          "Jangan biarkan kemarahan menghancurkan pondasi cinta yang telah dibangun bertahun-tahun.",
          "Didiklah anak-anakmu dengan adab dan ilmu agama, karena mereka adalah investasi akhiratmu.",
          "Suami yang baik adalah yang paling lembut kepada istrinya, dan istri yang salihah adalah perhiasan dunia.",
          "Selesaikan setiap masalah dengan musyawarah dan kepala yang dingin.",
          "Semoga Allah mengumpulkan kembali keluarga kita di dalam surga-Nya yang kekal.",
          "Subscribe channel ini untuk inspirasi harian membangun keluarga sakinah mawaddah warahmah."
        ]
      },
      {
        title: "Rahasia Tenang di Tengah Badai Hidup",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-30T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Hanya dengan mengingat Allah, hati akan menjadi tenang dan damai.",
          "Dunia ini adalah tempat ujian, maka jangan terlalu berharap menemukan kenyamanan sempurna di sini.",
          "Serahkan segala urusanmu kepada-Nya, karena Dialah sebaik-baiknya pengatur segalanya.",
          "Ketika manusia mengecewakanmu, itu adalah cara Allah agar kamu kembali berharap hanya kepada-Nya.",
          "Jadikan shalat sebagai tempat istirahatmu dari penatnya hiruk-pikuk kehidupan dunia.",
          "Syukuri setiap hal kecil, maka kamu akan diberikan kekuatan untuk menghadapi hal-hal besar.",
          "Ketenangan sejati bukan saat tidak ada masalah, tapi saat hatimu selalu merasa diawasi oleh Allah.",
          "Jangan pernah berputus asa, karena rahmat-Nya jauh lebih besar dari semua masalahmu.",
          "Pastikan kamu subscribe channel ini agar tidak ketinggalan motivasi penyejuk hati setiap hari."
        ]
      },
      {
        title: "Sedekah: Investasi yang Tak Pernah Rugi",
        topic: "Keberkahan",
        publishAt: new Date("2026-05-30T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Harta tidak akan pernah berkurang karena sedekah, justru ia akan bertumbuh dan berkah.",
          "Sedekah adalah bukti kejujuran iman dan tameng dari api neraka yang menyala.",
          "Jangan menunggu kaya untuk memberi, karena sedekah paling utama adalah saat kita sedang butuh.",
          "Senyummu di hadapan saudaramu adalah sedekah yang paling mudah dan ringan.",
          "Tangan di atas jauh lebih baik dan lebih mulia daripada tangan yang di bawah.",
          "Berikanlah yang terbaik, maka Allah akan membalasmu dengan balasan yang tak terduga.",
          "Jadilah saluran berkat bagi orang lain, maka keberkahan akan selalu mengalir dalam hidupmu.",
          "Sedekahmu hari ini bisa jadi adalah penolongmu di hari kiamat nanti.",
          "Mari subscribe channel ini untuk mendukung penyebaran konten positif dan bermanfaat."
        ]
      },
      {
        title: "Pentingnya Menjaga Lisan",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-31T05:30:00+07:00").toISOString(),
        narrationSegments: [
          "Keselamatan manusia bergantung pada kemampuannya dalam menjaga lisan.",
          "Satu kata yang buruk bisa melukai hati lebih dalam daripada tajamnya sebilah pedang.",
          "Berkatalah yang baik atau diam, itu adalah wasiat indah dari Baginda Nabi Muhammad SAW.",
          "Jangan gunakan lisanmu untuk ghibah atau merendahkan martabat sesama manusia.",
          "Lisan yang basah dengan dzikir akan membuat wajahmu bercahaya dan hatimu lapang.",
          "Berpikir sebelum berucap adalah ciri orang yang berakal dan bertakwa.",
          "Jadilah pribadi yang lisan-nya selalu menyejukkan dan memberikan semangat bagi orang lain.",
          "Semoga Allah selalu menjaga lisan kita dari kata-kata yang tidak bermanfaat.",
          "Jangan lupa subscribe channel ini untuk terus belajar memperbaiki diri setiap harinya."
        ]
      },
      {
        title: "Istiqomah di Jalan Hijrah",
        topic: "Motivasi Islam",
        publishAt: new Date("2026-05-31T15:30:00+07:00").toISOString(),
        narrationSegments: [
          "Hijrah bukan tentang menjadi orang suci, tapi tentang keinginan untuk menjadi lebih baik.",
          "Istiqomah adalah ujian yang sesungguhnya setelah kita memutuskan untuk berhijrah.",
          "Jangan pedulikan nyinyiran manusia, fokuslah pada penilaian Allah Sang Penguasa Semesta.",
          "Carilah lingkungan yang baik, karena teman yang salih akan membawamu lebih dekat ke surga.",
          "Jika kamu jatuh, segera bangkit dan bertaubat, karena pintu maaf-Nya selalu terbuka lebar.",
          "Perjalanan hijrah memang melelahkan, tapi hadiahnya adalah surga yang penuh kenikmatan.",
          "Mintalah ketetapan hati kepada Allah, karena Dialah yang membolak-balikkan hati hamba-Nya.",
          "Semoga kita semua bisa wafat dalam keadaan husnul khatimah dan diridhai oleh-Nya.",
          "Klik tombol subscribe sekarang juga untuk terus istiqomah belajar bersama channel ini."
        ]
      }
    ];

    try {
        await axios.post('http://localhost:3000/api/automation/bulk-run', {
            voice: 'edge-id-gadis',
            speed: 0.9,
            bgmMood: 'peaceful',
            platforms: { youtube: true, facebook: true, tiktok: true },
            items: items
        });

        let queue = [];
        if (fs.existsSync(queuePath)) {
            queue = JSON.parse(fs.readFileSync(queuePath, 'utf8'));
        }

        queue.push({
            id: require('crypto').randomUUID(),
            command: "Buatkan 10 video motivasi Islam. Jadwal: 27-31 Mei jam 05:30 & 15:30. Suara Gadis.",
            status: "completed",
            timestamp: new Date().toISOString(),
            response: "Claude telah menyusun 10 naskah motivasi Islam yang menyejukkan hati. Video dijadwalkan 2x sehari mulai 27 Mei 2026 menggunakan suara Gadis.",
            actionLogs: [
                "Menulis 10 naskah bertema Islam, rezeki, keluarga, dan cinta.",
                "Menambahkan ajakan subscribe di setiap akhir naskah.",
                "Mengatur penjadwalan 05:30 dan 15:30 menggunakan suara Gadis.",
                "Bulk automation telah dipicu."
            ]
        });

        fs.writeFileSync(queuePath, JSON.stringify(queue, null, 2));
        console.log("Successfully sent Islamic bulk run to backend.");
    } catch (err) {
        console.error("Error triggering Islamic bulk run:", err.message);
    }
}

processIslamicVideos();
