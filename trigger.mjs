import fetch from "node-fetch"; // Next.js environment has global fetch, but we run in node. Wait, Node 18+ has global fetch.

async function run() {
  console.log("Triggering scrape API...");
  const response = await fetch("http://localhost:3000/api/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      category: "Indian businesses",
      location: "USA",
      maxLeads: 200,
      mustHaveWebsite: false, // We want businesses WITHOUT a website (needs web dev) or maybe we just want to find any leads and filter later.
      // Wait, the API route does: if (mustHaveWebsite) finalBatch.filter(l => l.website). It DOES NOT filter for lack of website.
      // So let's just scrape 200 leads, they are automatically stored in the DB by the API.
    })
  });

  if (!response.ok) {
    console.error("Failed:", response.status, response.statusText);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    
    const lines = chunk.split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const data = JSON.parse(line);
        if (data.type === 'status') {
           console.log("[STATUS]", data.message);
        } else if (data.type === 'leads') {
           console.log(`[LEADS] Found ${data.data.length} leads in this batch.`);
        } else if (data.type === 'done') {
           console.log("[DONE]", data.message);
        } else if (data.type === 'error') {
           console.error("[ERROR]", data.message);
        }
      } catch(e) {
        console.log("Raw:", line);
      }
    }
  }
}

run().catch(console.error);
