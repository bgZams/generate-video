
const youtubeService = require('../services/youtubeService');
async function test() {
    console.log('Is Authenticated:', youtubeService.isAuthenticated());
    const profile = await youtubeService.getChannelProfile();
    console.log('Profile:', profile);
}
test();
