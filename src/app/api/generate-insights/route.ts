import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { lead } = await req.json();
    if (!lead) {
      return NextResponse.json({ error: "Missing lead data" }, { status: 400 });
    }

    // 1. Get Groq Key
    let groqApiKey = process.env.GROQ_API_KEY || "";
    try {
      const { data } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "groq_api_key")
        .single();
      if (data?.value) {
        groqApiKey = data.value;
      }
    } catch (e) {
      // Graceful fallback to default key
    }

    // 2. Prepare analysis points
    const websiteStatus = lead.website ? `Website URL: ${lead.website}` : "No website link found on Google Maps.";
    const gmbRating = lead.rating ? `GMB Rating: ${lead.rating} stars` : "No rating score found.";
    const gmbReviews = lead.reviews ? `GMB Review Count: ${lead.reviews} reviews` : "No reviews count found.";
    const instagramStatus = lead.instagram ? `Instagram page: ${lead.instagram}` : "No Instagram profile associated.";
    const facebookStatus = lead.facebook ? `Facebook page: ${lead.facebook}` : "No Facebook page associated.";

    // 3. Build prompt (Strict instructions: Cold calling focus, NO WhatsApp templates, show what to offer)
    const prompt = `
You are an expert sales strategist training a cold-call agent.
Analyze the following details for the business lead and generate actionable advice:

Business Name: ${lead.name}
Category: ${lead.category || "General"}
Location: ${lead.location || "Haryana"}
${websiteStatus}
${gmbRating}
${gmbReviews}
${instagramStatus}
${facebookStatus}

Instructions:
1. Identify WHAT the agent can offer to this customer (e.g., website redesign, SSL certificate installation, local SEO optimization, GMB review generation, social media setup).
2. Write a highly tailored Phone Call opening script. Keep it friendly, short, and focused on starting a conversation (DO NOT write email or WhatsApp messages).
3. Do not include any meta-commentary. Return your response in clean markdown with two main sections:
   - **What to Offer (Pitch Points)**
   - **Tailored Phone Script**
`;

    // 4. Call Groq
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqApiKey}`
      },
      body: JSON.stringify({
        model: "llama3-8b-8192",
        messages: [
          { role: "system", content: "You are a helpful and concise sales coaching assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    if (!groqResponse.ok) {
      const errorText = await groqResponse.text();
      return NextResponse.json({ error: `Groq API Error: ${errorText}` }, { status: groqResponse.status });
    }

    const groqData = await groqResponse.json();
    const insights = groqData.choices?.[0]?.message?.content || "Could not generate insights.";

    return NextResponse.json({ insights });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
