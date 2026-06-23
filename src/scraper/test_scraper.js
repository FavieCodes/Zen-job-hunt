require('dotenv').config({ path: '../.env' });
const { runScraper } = require('./scraper.service');

// Mock db.query so we can see what it's doing without connecting
const db = require('../config/db');
let mockJobsCount = 0;
let mockSchCount = 0;

db.query = async (sql, params) => {
  if (sql.includes('INSERT INTO jobs')) {
    mockJobsCount++;
    return { rows: [{ id: 1 }] }; // mock inserted
  }
  if (sql.includes('INSERT INTO scholarships')) {
    mockSchCount++;
    return { rows: [{ id: 1 }] };
  }
  return { rows: [] };
};

// Override APIs and HTML so it's fast
const scraperService = require('./scraper.service');

(async () => {
  console.log('Running scraper with mocked DB...');
  try {
    const results = await scraperService.runScraper();
    console.log('Finished!', results);
    console.log(`DB mock saw ${mockJobsCount} job inserts and ${mockSchCount} scholarship inserts`);
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
})();
