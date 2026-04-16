
const axios = require('axios');

async function testValidation() {
    try {
        console.log('Sending invalid request...');
        const res = await axios.post('http://127.0.0.1:3000/api/narration/generate', {
            topic: '',
            slideCount: 0,
            count: 0
        });
        console.log('❌ SUCCESS? Status:', res.status);
    } catch (error) {
        if (error.response) {
            console.log('✅ CAUGHT ERROR:', error.response.status, error.response.data);
        } else {
            console.log('❌ CAUGHT OTHER ERROR:', error.message);
        }
    }
}

testValidation();
