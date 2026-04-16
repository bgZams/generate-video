const axios = require('axios');

async function testApi() {
    try {
        console.log('Testing /api/scheduler/status...');
        const resStatus = await axios.get('http://localhost:3000/api/scheduler/status');
        console.log('Status Result:', resStatus.data);

        console.log('\nTesting /api/youtube/auth-url...');
        const resYoutube = await axios.get('http://localhost:3000/api/youtube/auth-url');
        console.log('Youtube Result:', resYoutube.data);
    } catch (err) {
        console.error('API Test Failed:', err.response ? err.response.data : err.message);
    }
}

testApi();
