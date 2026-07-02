const youtubeService = require('./services/youtubeService');
const { generateActualShorts } = require('./generate_islamic_shorts');

async function uploadAllShorts() {
    if (!youtubeService.isAuthenticated()) {
        console.error('❌ YouTube Service not authenticated. Please run the YouTube connect flow first.');
        console.error('Visit http://localhost:3000/api/youtube/connect to authenticate.');
        process.exit(1);
    }

    const videosToUpload = await generateActualShorts();
    const uploadResults = [];

    for (const video of videosToUpload) {
        console.log(`
--- Processing: ${video.title} ---
`);
        try {
            const result = await youtubeService.uploadVideo({
                path: video.videoPath,
                title: video.title,
                description: video.description,
                tags: ['NasehatIslami', 'ShortsDakwah', 'VideoIslami', 'RenunganHarian', 'MuslimInspirasi'],
                privacyStatus: 'private', // Untuk testing, set ke private dulu
                thumbnailPath: video.thumbnailPath
            });
            uploadResults.push({ ...result, title: video.title });
        } catch (error) {
            console.error(`❌ Failed to upload "${video.title}":`, error.message);
            uploadResults.push({ success: false, title: video.title, error: error.message });
        }
    }

    console.log('\n=== All Shorts Upload Processed ===');
    for (const res of uploadResults) {
        if (res.success) {
            console.log(`✅ "${res.title}" uploaded! URL: ${res.url}`);
            if (res.thumbnail && !res.thumbnail.success) {
                console.log(`   ⚠️ Thumbnail for "${res.title}" failed to upload: ${res.thumbnail.error}`);
            }
        } else {
            console.error(`❌ "${res.title}" failed: ${res.error}`);
        }
    }
    console.log('=====================================');
}

uploadAllShorts().catch(console.error);
