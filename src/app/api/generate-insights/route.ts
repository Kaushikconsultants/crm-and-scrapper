import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { lead, language = "English", agentName = "our agent", previousCalls = [] } = await req.json();
    if (!lead) {
      return NextResponse.json({ error: "Missing lead data" }, { status: 400 });
    }

    // 1. Get Groq Key & Model
    let groqApiKey = process.env.GROQ_API_KEY || "";
    let groqModel = "llama-3.3-70b-versatile";
    try {
      const { data } = await supabase
        .from("settings")
        .select("*");
      
      if (data) {
        const config: Record<string, string> = {};
        data.forEach(row => {
          config[row.key] = row.value;
        });
        if (config.groq_api_key) groqApiKey = config.groq_api_key;
        if (config.groq_model) groqModel = config.groq_model;
      }
    } catch (e) {
      // Graceful fallback to defaults
    }

    // 2. Fetch Knowledge Base context if available
    let knowledgeContext = "";
    try {
      const { data: kbData } = await supabase
        .from("knowledge_base")
        .select("type, title, content, source_url");
      if (kbData && kbData.length > 0) {
        knowledgeContext = "Company Knowledge Base & Services Catalog Context:\n" + 
          kbData.map((doc: any) => `- [${doc.type.toUpperCase()}] ${doc.title}: ${doc.content || doc.source_url || ""}`).join("\n");
      }
    } catch (e) {
      // Graceful fallback if table is not yet set up
    }

    // 3. Prepare analysis points
    const websiteStatus = lead.website ? `Website URL: ${lead.website}` : "No website link found on Google Maps.";
    const gmbRating = lead.rating ? `GMB Rating: ${lead.rating} stars` : "No rating score found.";
    const gmbReviews = lead.reviews ? `GMB Review Count: ${lead.reviews} reviews` : "No reviews count found.";
    const instagramStatus = lead.instagram ? `Instagram page: ${lead.instagram}` : "No Instagram profile associated.";
    const facebookStatus = lead.facebook ? `Facebook page: ${lead.facebook}` : "No Facebook page associated.";

    const formattedCalls = previousCalls.length > 0 
      ? previousCalls.map((log: any) => `- Outcome: ${log.status_marked || 'Call'}, Notes: ${log.notes || 'No notes'}`).join('\n')
      : "No previous calls logged yet.";

    // 4. Build prompt (Branding: Hyperscript Solutions, Website: hyperscriptsolutions.in, Insta: @hyperscriptsolutions)
    const prompt = `
You are an expert sales strategist training a cold-call agent.
Generate a tailored sales pitch on behalf of our agency:
- Company Name: Hyperscript Solutions
- Agency Website: https://hyperscriptsolutions.in
- Agency Instagram: @hyperscriptsolutions
- Pitching Agent Name: ${agentName}

${knowledgeContext ? `${knowledgeContext}\n` : ""}

Client Business Name: ${lead.name}
Category: ${lead.category || "General"}
Location: ${lead.location || "Haryana"}
${websiteStatus}
${gmbRating}
${gmbReviews}
${instagramStatus}
${facebookStatus}

Previous Interactions with this Client:
${formattedCalls}

Instructions:
1. Identify WHAT services Hyperscript Solutions can offer to this client based on their website gaps (e.g. lack of website/redesign, SEO fixes, social media setup, or GMB review growth) and matching our company knowledge base/services catalog context.
2. Formulate a personalized, conversational Phone Call script for ${agentName} to introduce Hyperscript Solutions, reference any previous call history if available, and pitch the suggested services.
3. OUTPUT LANGUAGE REQUIREMENT: Your entire response (pitch points and phone script) MUST be written in ${language}. If the language is "Hinglish", use Hindi vocabulary written in the English script/alphabet (e.g., "Hello! Main Hyperscript Solutions se ${agentName} bol raha hoon...").
4. Do not include any intro/outro commentary. Return your response in clean markdown with two sections:
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
        model: groqModel,
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
