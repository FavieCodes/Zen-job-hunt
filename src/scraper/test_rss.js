const axios = require('axios');
const xml2js = require('xml2js');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
];
const randomAgent = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

async function fetchRSS(url) {
  const res = await axios.get(url, {
    headers: { 'User-Agent': randomAgent(), Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    timeout: 15000,
  });
  const parser = new xml2js.Parser({ explicitArray: false, ignoreAttrs: false });
  const result = await parser.parseStringPromise(res.data);
  const items = result?.rss?.channel?.item || result?.feed?.entry || [];
  return Array.isArray(items) ? items : [items];
}

function rssItemToScholarship(item, sourceName) {
  const title   = item.title?._ || item.title || '';
  const link    = item.link?._ || item.link || item.guid?._ || item.guid || null;
  const pubDate = item.pubDate || item.published || null;
  const desc    = (item.description || item.summary || '')
    .toString().replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

  // Try to detect deadline from description
  const deadlineMatch = desc.match(/deadline[:\s]+([A-Za-z]+ \d{1,2},?\s*\d{4}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i);
  let deadline = null;
  if (deadlineMatch) {
    const d = new Date(deadlineMatch[1]);
    if (!isNaN(d)) deadline = d.toISOString().split('T')[0];
  }

  return {
    title:       title,
    provider:    null,
    description: desc || null,
    country:     null,
    field:       null,
    deadline,
    amount:      null,
    apply_url:   link,
    source_url:  link,
    source_name: sourceName,
    posted_at:   pubDate ? new Date(pubDate).toISOString() : null,
  };
}

(async () => {
  const url = 'https://opportunitydesk.org/feed/';
  try {
    const items = await fetchRSS(url);
    console.log(`Found ${items.length} items`);
    const mapped = items.map(item => rssItemToScholarship(item, 'Opportunity Desk'));
    console.log('Mapped item 0:', mapped[0]);
  } catch(e) {
    console.error(e);
  }
})();
