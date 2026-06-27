import http from 'http';

const categories = [
  "saloons",
  "clothing manufacturer",
  "clothing wholesaler",
  "clothing retailer",
  "boutiques",
  "academies"
];

const location = "Haryana";
const maxLeadsPerCategory = 90; // Total around 540 leads maximum

async function scrapeCategory(category) {
  return new Promise((resolve, reject) => {
    console.log(`\n========================================`);
    console.log(`Starting scrape for: ${category} in ${location}`);
    console.log(`========================================`);
    
    const req = http.request("http://localhost:3000/api/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }, (res) => {
      res.on('data', (chunk) => {
        const lines = chunk.toString().split('\n');
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === 'status') {
              console.log(`[STATUS] ${data.message}`);
            } else if (data.type === 'leads') {
              console.log(`[LEADS] Found ${data.data.length} new leads!`);
              // Print just the names so we can see what's coming in
              data.data.forEach(l => console.log(`  - ${l.name}`));
            } else if (data.type === 'done') {
              console.log(`[DONE] ${data.message}`);
            } else if (data.type === 'error') {
              console.error(`[ERROR] ${data.message}`);
            }
          } catch(e) {
            console.log(`[RAW] ${line}`);
          }
        }
      });
      res.on('end', resolve);
    });

    req.on('error', reject);
    
    req.write(JSON.stringify({
      category,
      location,
      maxLeads: maxLeadsPerCategory
    }));
    req.end();
  });
}

async function run() {
  for (const category of categories) {
    try {
      await scrapeCategory(category);
    } catch (e) {
      console.error(`Request failed for ${category}:`, e.message);
    }
  }
  console.log("\nAll scraping tasks finished!");
}

run();
