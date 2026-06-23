const axios = require('axios');

async function testJobicy() {
  try {
    const res = await axios.get('https://jobicy.com/api/v2/remote-jobs?count=5&geo=usa', { timeout: 15000 });
    console.log('Jobicy USA:', res.data?.jobs?.length || 0);
  } catch(e) {
    console.error('Jobicy Error:', e.message);
  }
}

async function testRemotive() {
  try {
    const res = await axios.get('https://remotive.com/api/remote-jobs?limit=500', { timeout: 15000 });
    console.log('Remotive:', res.data?.jobs?.length || 0);
  } catch(e) {
    console.error('Remotive Error:', e.message);
  }
}

async function testTheMuse() {
  try {
    const res = await axios.get('https://www.themuse.com/api/public/jobs?page=1&descending=true', { timeout: 15000 });
    console.log('TheMuse:', res.data?.results?.length || 0);
  } catch(e) {
    console.error('TheMuse Error:', e.message);
  }
}

(async () => {
  await testJobicy();
  await testRemotive();
  await testTheMuse();
})();
