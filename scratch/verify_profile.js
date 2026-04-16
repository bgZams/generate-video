
const axios = require('axios');
async function test() {
    try {
        const res = await axios.get('http://127.0.0.1:3000/api/scheduler/status');
        console.log('Status Result:', JSON.stringify(res.data, null, 2));
    } catch (e) {
        console.log('Error:', e.message);
    }
}
test();
