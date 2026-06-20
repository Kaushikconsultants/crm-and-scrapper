import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { createClient } from '@supabase/supabase-js';

puppeteer.use(StealthPlugin());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const categories = [
    "boutiques",
    "salons",
    "academies",
    "dental clinic",
    "clinics",
    "hospitals",
    "interior designers",
    "restaurants"
  ];
  
  const location = "Haryana";
  const targetLeadsCount = 500;
  let totalExtracted = 0;

  console.log(`Starting scraper for Haryana targeting categories: ${categories.join(', ')}`);
  console.log(`Goal: Extract ${targetLeadsCount} new unique leads not present in the DB.`);

  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    for (const category of categories) {
      if (totalExtracted >= targetLeadsCount) {
        console.log(`\nReached goal of ${targetLeadsCount} leads! Stopping.`);
        break;
      }

      console.log(`\n========================================`);
      console.log(`Starting Category: ${category} (Progress: ${totalExtracted}/${targetLeadsCount} leads)`);
      console.log(`========================================`);

      const page = await browser.newPage();
      await page.setViewport({ width: 1280, height: 800 });

      const searchQuery = `${category} in ${location}`;
      const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      
      console.log(`Searching Google Maps for: ${searchQuery}...`);
      await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

      try {
        await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
      } catch (e) {
        console.log("Warning: Feed not found immediately. Retrying or skipping.");
      }

      let unchangedCount = 0;
      const processedNames = new Set();
      let isEndOfList = false;

      while (totalExtracted < targetLeadsCount && unchangedCount < 5 && !isEndOfList) {
        console.log(`Scrolling feed... (New leads added this run: ${totalExtracted}/${targetLeadsCount})`);

        isEndOfList = await page.evaluate(async () => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) {
            const items = feed.querySelectorAll('div');
            if (items.length > 0) {
               items[items.length - 1].scrollIntoView();
            }
            await new Promise((resolve) => setTimeout(resolve, 3000));
            return feed.innerText.includes("You've reached the end of the list");
          }
          return false;
        });

        const currentLeads = await page.evaluate(() => {
          const results = [];
          const items = Array.from(document.querySelectorAll('div[role="feed"] > div'));
          
          for (const item of items) {
            try {
              if (item.dataset.scraped === "true") continue;
              item.dataset.scraped = "true";

              const nameElement = item.querySelector('div.fontHeadlineSmall, div.qBF1Pd');
              const name = nameElement ? nameElement.innerText : null;
              if (!name) continue;

              let rating = null;
              let reviews = null;
              const ratingElement = item.querySelector('span[role="img"]');
              if (ratingElement) {
                const ariaLabel = ratingElement.getAttribute('aria-label');
                if (ariaLabel) {
                   const ratingMatch = ariaLabel.match(/([\d.]+)\s+stars/i);
                   const reviewMatch = ariaLabel.match(/([\d,]+)\s+Reviews/i);
                   if (ratingMatch) rating = ratingMatch[1];
                   if (reviewMatch) reviews = reviewMatch[1];
                }
              }

              let gmbUrl = null;
              const link = item.querySelector('a');
              if (link) gmbUrl = link.href;

              results.push({ name, rating, reviews, phone: null, website: null, instagram: null, facebook: null, gmbUrl });
            } catch (e) {}
          }
          return results;
        });

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
          
          let finalBatch = [];
          const namesToCheck = newLeadsInBatch.map(l => l.name);
          
          const { data: existingRecords } = await supabase
            .from('leads')
            .select('*')
            .in('name', namesToCheck);
            
          const existingMap = new Map(existingRecords?.map(r => [r.name, r]) || []);
          
          for (const lead of newLeadsInBatch) {
             if (existingMap.has(lead.name)) {
                console.log(`Skipping duplicate: ${lead.name}`);
             } else {
                finalBatch.push(lead);
             }
          }

          if (finalBatch.length > 0) {
              console.log(`Found ${finalBatch.length} new potential leads. Starting deep scans...`);
              for (let i = 0; i < finalBatch.length; i++) {
                  const lead = finalBatch[i];
                  if (!lead.gmbUrl) continue;
                  
                  try {
                      const detailPage = await browser.newPage();
                      await detailPage.goto(lead.gmbUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
                      await new Promise(r => setTimeout(r, 3500));
                      
                      const deepData = await detailPage.evaluate(() => {
                          let phone = null, website = null, instagram = null, facebook = null;

                          const phoneBtn = document.querySelector('[data-item-id^="phone:tel:"]');
                          if (phoneBtn) {
                             const match = phoneBtn.getAttribute('data-item-id')?.match(/phone:tel:(.+)/);
                             if (match) phone = match[1];
                          } 
                          if (!phone) {
                             const tooltipBtn = document.querySelector('button[data-tooltip*="phone" i], button[aria-label*="phone" i]');
                             if (tooltipBtn) {
                                 phone = tooltipBtn.innerText || tooltipBtn.getAttribute('aria-label')?.replace(/phone|number|call|:/gi, '').trim();
                             }
                          }
                          if (!phone) {
                             const paneText = document.body.innerText;
                             const phoneMatch = paneText.match(/(\+?\d[\d\s\-()]{7,16}\d)/g);
                             if (phoneMatch) {
                                 for (const m of phoneMatch) {
                                     if (m.replace(/\D/g, '').length >= 8) { phone = m.trim(); break; }
                                 }
                             }
                          }

                          const webBtn = document.querySelector('[data-item-id^="authority:"]');
                          if (webBtn) {
                             const match = webBtn.getAttribute('data-item-id')?.match(/authority:(.+)/);
                             if (match) website = match[1];
                          } else {
                             const webTooltip = document.querySelector('a[data-tooltip*="website" i]');
                             if (webTooltip) website = webTooltip.href;
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
                      
                      console.log(`  Scraped: ${lead.name} | Phone: ${lead.phone || 'None'} | Web: ${lead.website ? 'Yes' : 'No'}`);
                      await detailPage.close().catch(() => {});
                  } catch (e) {
                     console.log(`  Failed to deep scan ${lead.name}`);
                  }
              }
          }

          if (totalExtracted + finalBatch.length > targetLeadsCount) {
            finalBatch = finalBatch.slice(0, targetLeadsCount - totalExtracted);
          }

          if (finalBatch.length > 0) {
            console.log(`Inserting ${finalBatch.length} leads to Supabase...`);
            const recordsToInsert = finalBatch.map(l => ({ ...l, category, location, source_platform: 'Google Maps' }));
            
            const { error: insertError } = await supabase.from('leads').insert(recordsToInsert);
            
            if (insertError) {
               console.error("Supabase insert error:", insertError);
            } else {
               console.log(`Successfully saved ${finalBatch.length} leads.`);
            }
            
            totalExtracted += finalBatch.length;
          }
        }
      }
      
      await page.close().catch(() => {});
    }

    console.log(`\nScraping complete! Added ${totalExtracted} new unique leads to Supabase.`);
  } catch (error) {
    console.error("Scraping error:", error);
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    process.exit(0);
  }
}

run();
