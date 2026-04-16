
const youtubeService = require('./services/youtubeService');

async function checkChannel() {
    if (!youtubeService.isAuthenticated()) {
        console.log('❌ Belum terhubung ke YouTube.');
        return;
    }

    try {
        const response = await youtubeService.youtube.channels.list({
            part: 'snippet,statistics',
            mine: true
        });

        const channel = response.data.items[0];
        if (channel) {
            console.log('\n📺 Informasi Channel Terhubung:');
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            console.log(`Nama Channel : ${channel.snippet.title}`);
            console.log(`ID Channel   : ${channel.id}`);
            console.log(`Subscribers  : ${channel.statistics.subscriberCount}`);
            console.log(`Thumbnail    : ${channel.snippet.thumbnails.default.url}`);
            console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        } else {
            console.log('❌ Tidak ada channel ditemukan untuk akun ini.');
        }
    } catch (error) {
        console.error('❌ Gagal mengambil info channel:', error.message);
    }
}

checkChannel();
