import { NextResponse } from "next/server";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";
import { supabase } from "@/lib/supabase";

puppeteer.use(StealthPlugin());

export const maxDuration = 300; // Allow up to 5 minutes

export async function POST(req: Request) {
  const { category, location, maxLeads = 20, mustHaveWebsite, mustHaveInstagram, mustHaveFacebook, mustHavePhone } = await req.json();

  if (!category || !location) {
    return NextResponse.json({ error: "Missing category or location" }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendChunk = (data: any) => {
        controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
      };

      let browser = null;
      let runId = null;

      try {
        // Log Scraper Run Start
        try {
          const { data: runData } = await supabase
            .from("scraper_runs")
            .insert({
              category,
              location,
              max_leads: maxLeads,
              status: "Running",
              leads_found: 0
            })
            .select("id")
            .single();
          if (runData) {
            runId = runData.id;
          }
        } catch (e) {
          console.warn("Failed to log scraper run start (table might not exist):", e);
        }

        sendChunk({ type: "status", message: "Launching browser engine..." });
        
        browser = await puppeteer.launch({
          headless: true,
          args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const searchQuery = `${category} in ${location}`;
        sendChunk({ type: "status", message: `Searching Google Maps for: ${searchQuery}...` });
        
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

        try {
          await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
        } catch (e) {
          sendChunk({ type: "status", message: "Warning: Feed not found immediately, results might be empty." });
        }

        let totalExtracted = 0;
        let unchangedCount = 0;
        const processedNames = new Set<string>();

        let isEndOfList = false;

        while (totalExtracted < maxLeads && unchangedCount < 4 && !isEndOfList) {
          sendChunk({ type: "status", message: `Scrolling feed... (Found ${totalExtracted}/${maxLeads} new leads so far)` });
          
          isEndOfList = await page.evaluate(async () => {
            const feed = document.querySelector('div[role="feed"]');
            if (feed) {
              const items = feed.querySelectorAll('div');
              if (items.length > 0) {
                 items[items.length - 1].scrollIntoView();
              }
              await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait for network
              
              // Check if we hit the end
              return (feed as HTMLElement).innerText.includes("You've reached the end of the list");
            }
            return false;
          });

          const currentLeads = await page.evaluate(() => {
            const results: any[] = [];
            const items = Array.from(document.querySelectorAll('div[role="feed"] > div'));
            
            for (const item of items) {
              try {
                const itemEl = item as HTMLElement;
                
                // Skip if already scraped in this session
                if (itemEl.dataset.scraped === "true") continue;
                itemEl.dataset.scraped = "true";

                const nameElement = itemEl.querySelector('div.fontHeadlineSmall, div.qBF1Pd');
                const name = nameElement ? (nameElement as HTMLElement).innerText : null;
                if (!name) continue;

                let rating = null;
                let reviews = null;
                const ratingElement = itemEl.querySelector('span[role="img"]');
                if (ratingElement) {
                  const ariaLabel = ratingElement.getAttribute('aria-label');
                  if (ariaLabel) {
                     const ratingMatch = ariaLabel.match(/([\d.]+)\s+stars/i);
                     const reviewMatch = ariaLabel.match(/([\d,]+)\s+Reviews/i);
                     if (ratingMatch) rating = ratingMatch[1];
                     if (reviewMatch) reviews = reviewMatch[1];
                  }
                }

                let phone = null;
                let website = null;
                let instagram = null;
                let facebook = null;
                let gmbUrl = null;

                const link = itemEl.querySelector('a');
                if (link) gmbUrl = link.href;

                results.push({ name, rating, reviews, phone: null, website: null, instagram: null, facebook: null, gmbUrl });
              } catch (e) {}
            }
            return results;
          });

          // Deduplicate in memory for this session
          const newLeadsInBatch = [];
          for (const lead of currentLeads) {
            if (!processedNames.has(lead.name)) {
              processedNames.add(lead.name);
              newLeadsInBatch.push(lead);
            }
          }

          if (newLeadsInBatch.length === 0) {
            unchangedCount++;
          } else {
            unchangedCount = 0;
            
            // Check against Supabase Database
            let finalBatch = newLeadsInBatch;
            if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
              const namesToCheck = newLeadsInBatch.map(l => l.name);
              const { data: existingRecords } = await supabase
                .from('leads')
                .select('*')
                .in('name', namesToCheck);
                
              const existingMap = new Map(existingRecords?.map(r => [r.name, r]) || []);
              
              finalBatch = [];
              for (const lead of newLeadsInBatch) {
                 if (existingMap.has(lead.name)) {
                    // It already exists in DB. Diff it to see if we have NEW info to enrich the DB.
                    const existingLead = existingMap.get(lead.name);
                    const updates: any = {};
                    
                    if (lead.phone && !existingLead.phone) updates.phone = lead.phone;
                    if (lead.website && !existingLead.website) updates.website = lead.website;
                    if (lead.instagram && !existingLead.instagram) updates.instagram = lead.instagram;
                    if (lead.facebook && !existingLead.facebook) updates.facebook = lead.facebook;
                    if (lead.gmbUrl && !existingLead.gmbUrl) updates.gmbUrl = lead.gmbUrl;
                    
                    if (Object.keys(updates).length > 0) {
                       // Silent background update to enrich DB.
                       supabase.from('leads').update(updates).eq('name', existingLead.name).then(() => {}, () => {});
                    }
                    // It's a duplicate (even if updated), so do NOT push to finalBatch
                 } else {
                    finalBatch.push(lead);
                 }
              }
            }

            // DEEP EXTRACTION FOR NEW LEADS (New Tab method)
            if (finalBatch.length > 0) {
                sendChunk({ type: "status", message: `Deep scanning ${finalBatch.length} new leads for contact info...` });
                for (let i = 0; i < finalBatch.length; i++) {
                    const lead = finalBatch[i];
                    if (!lead.gmbUrl) continue;
                    
                    try {
                    const detailPage = await browser.newPage();
                    // Use domcontentloaded instead of networkidle2 to prevent hanging on tracking pixels
                    await detailPage.goto(lead.gmbUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
                    
                    // Give React time to render the left panel data
                    await new Promise(r => setTimeout(r, 3500));
                    
                    const deepData = await detailPage.evaluate(() => {
                        let phone = null;
                        let website = null;
                        let instagram = null;
                        let facebook = null;

                        // 1. Try standard Google Maps data-item-id
                        const phoneBtn = document.querySelector('[data-item-id^="phone:tel:"]');
                        if (phoneBtn) {
                           const match = phoneBtn.getAttribute('data-item-id')?.match(/phone:tel:(.+)/);
                           if (match) phone = match[1];
                        } 
                        
                        // 2. Try tooltips/aria-labels
                        if (!phone) {
                           const tooltipBtn = document.querySelector('button[data-tooltip*="phone" i], button[aria-label*="phone" i]');
                           if (tooltipBtn) {
                               phone = (tooltipBtn as HTMLElement).innerText || tooltipBtn.getAttribute('aria-label')?.replace(/phone|number|call|:/gi, '').trim();
                           }
                        }

                        // 3. Ultimate Fallback: regex on entire page text (lowered to 8 digits for local landlines)
                        if (!phone) {
                           const paneText = document.body.innerText;
                           const phoneMatch = paneText.match(/(\+?\d[\d\s\-()]{7,16}\d)/g);
                           if (phoneMatch) {
                               for (const m of phoneMatch) {
                                   if (m.replace(/\D/g, '').length >= 8) {
                                       phone = m.trim();
                                       break;
                                   }
                               }
                           }
                        }

                        const webBtn = document.querySelector('[data-item-id^="authority:"]');
                        if (webBtn) {
                           const match = webBtn.getAttribute('data-item-id')?.match(/authority:(.+)/);
                           if (match) website = match[1];
                        } else {
                           const webTooltip = document.querySelector('a[data-tooltip*="website" i]');
                           if (webTooltip) website = (webTooltip as HTMLAnchorElement).href;
                        }

                        const links = Array.from(document.querySelectorAll('a'));
                        for (const l of links) {
                           if (l.href.includes('instagram.com')) instagram = l.href;
                           if (l.href.includes('facebook.com')) facebook = l.href;
                        }

                        return { phone, website, instagram, facebook };
                    });
                    
                    if (deepData.phone) lead.phone = deepData.phone;
                    if (deepData.website) lead.website = deepData.website;
                    if (deepData.instagram) lead.instagram = deepData.instagram;
                    if (deepData.facebook) lead.facebook = deepData.facebook;
                    
                    await detailPage.close().catch(() => {});
                } catch (e) {
                    // Ignore page crash, move to next
                }    }
            }

            // Apply User Filters
            if (mustHaveWebsite) finalBatch = finalBatch.filter(l => l.website);
            if (mustHaveInstagram) finalBatch = finalBatch.filter(l => l.instagram);
            if (mustHaveFacebook) finalBatch = finalBatch.filter(l => l.facebook);
            if (mustHavePhone) finalBatch = finalBatch.filter(l => l.phone);

            // Cap at requested max
            if (totalExtracted + finalBatch.length > maxLeads) {
              finalBatch = finalBatch.slice(0, maxLeads - totalExtracted);
            }

            if (finalBatch.length > 0) {
              // Auto-save to Supabase
              if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
                const recordsToInsert = finalBatch.map(l => ({ ...l, category, location, source_platform: 'Google Maps' }));
                const { data: insertedData, error: insertError } = await supabase.from('leads').insert(recordsToInsert).select();
                if (insertError) {
                   console.error("Supabase insert error:", insertError);
                } else if (insertedData && insertedData.length > 0) {
                   finalBatch = insertedData; // Re-assign so frontend gets the DB IDs!
                }
              }
              
              sendChunk({ type: "leads", data: finalBatch });
              totalExtracted += finalBatch.length;
            }
          }
        }

        // Log Completion Success
        if (runId) {
          try {
            await supabase
              .from("scraper_runs")
              .update({ status: "Completed", leads_found: totalExtracted })
              .eq("id", runId);
          } catch (e) {}
        }

        sendChunk({ type: "done", message: `Scraping complete! Found ${totalExtracted} new unique leads.` });
      } catch (error: any) {
        console.error("Scraping error:", error);
        
        // Log Completion Failure
        if (runId) {
          try {
            await supabase
              .from("scraper_runs")
              .update({ status: "Failed" })
              .eq("id", runId);
          } catch (e) {}
        }

        sendChunk({ type: "error", message: error.message || "Failed to scrape data" });
      } finally {
        if (browser) {
          await browser.close().catch(() => {});
        }
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive"
    }
  });
}
