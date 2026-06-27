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

function isMobileNumber(phone) {
  if (!phone) return false;
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // Indian mobile numbers are 10 digits, or 12 digits with 91, or 11 with 0
  // Check if the last 10 digits start with 6, 7, 8, or 9
  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    return /^[6789]\d{9}$/.test(last10);
  }
  return false;
}

async function run() {
  const categories = [
    "manufacture company", 
    "clinic", 
    "academy", 
    "hotel", 
    "real estate company", 
    "car showroom", 
    "gym fitness centre", // Fixed 'zym' to 'gym' for better search results
    "salon", 
    "ngo", 
    "weight loss weight gain"
  ];
  const locations = ["Haryana", "Delhi", "Noida"];
  const maxLeadsTotal = 600;

  console.log(`Starting scraper for ${categories.length} categories in ${locations.join(', ')}`);
  
  let browser = null;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    let totalExtracted = 0;

    for (const location of locations) {
      for (const category of categories) {
        if (totalExtracted >= maxLeadsTotal) break;
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 800 });

        const searchQuery = `${category} in ${location}`;
        console.log(`\nSearching Google Maps for: ${searchQuery}...`);
        
        const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
        await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 60000 });

        try {
          await page.waitForSelector('div[role="feed"]', { timeout: 10000 });
        } catch (e) {
          console.log("Warning: Feed not found immediately, results might be empty.");
        }

        let unchangedCount = 0;
        const processedNames = new Set();
        let isEndOfList = false;
        
        let categoryLocationExtracted = 0;
        const maxPerCategoryLocation = 40; // Collect up to 40 per category/location to keep it distributed

        try {
          while (totalExtracted < maxLeadsTotal && categoryLocationExtracted < maxPerCategoryLocation && unchangedCount < 4 && !isEndOfList) {
            console.log(`Scrolling feed for ${category} in ${location}... (Found ${totalExtracted}/${maxLeadsTotal} total, ${categoryLocationExtracted}/${maxPerCategoryLocation} here)`);
            
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
              
              let finalBatch = newLeadsInBatch;
              const namesToCheck = newLeadsInBatch.map(l => l.name);
              
              const { data: existingRecords } = await supabase
                .from('leads')
                .select('*')
                .in('name', namesToCheck);
                
              const existingMap = new Map(existingRecords?.map(r => [r.name, r]) || []);
              
              finalBatch = [];
              for (const lead of newLeadsInBatch) {
                 if (existingMap.has(lead.name)) {
                    console.log(`Skipping duplicate: ${lead.name}`);
                 } else {
                    finalBatch.push(lead);
                 }
              }

              if (finalBatch.length > 0) {
                  console.log(`Deep scanning ${finalBatch.length} new leads for contact info...`);
                  for (let i = 0; i < finalBatch.length; i++) {
                      const lead = finalBatch[i];
                      if (!lead.gmbUrl) continue;
                      
                      try {
                          const detailPage = await browser.newPage();
                          await detailPage.goto(lead.gmbUrl, { waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => {});
                          await new Promise(r => setTimeout(r, 2000));
                          
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
                          
                          await detailPage.close().catch(() => {});
                      } catch (e) {
                         console.log(`Failed to deep scan ${lead.name}`);
                      }
                  }
              }

              // ONLY KEEP LEADS WITH A MOBILE NUMBER
              const mobileLeads = finalBatch.filter(lead => isMobileNumber(lead.phone));
              console.log(`Found ${mobileLeads.length} valid mobile numbers out of ${finalBatch.length} leads.`);
              finalBatch = mobileLeads;

              if (totalExtracted + finalBatch.length > maxLeadsTotal) {
                finalBatch = finalBatch.slice(0, maxLeadsTotal - totalExtracted);
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
                categoryLocationExtracted += finalBatch.length;
              }
            }
          }
        } catch (pageError) {
          console.error(`Error during scraping ${category} in ${location}:`, pageError.message);
        }
        
        await page.close().catch(() => {});
      }
    }

    console.log(`\nScraping complete! Found ${totalExtracted} new unique mobile leads.`);
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
