import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("*");

    if (error || !data) {
      return NextResponse.json({ 
        groq_api_key: process.env.GROQ_API_KEY || "",
        groq_model: "llama-3.3-70b-versatile",
        is_fallback: true
      });
    }

    const config: Record<string, string> = {};
    data.forEach(row => {
      config[row.key] = row.value;
    });

    return NextResponse.json({ 
      groq_api_key: config.groq_api_key || "",
      groq_model: config.groq_model || "llama-3.3-70b-versatile",
      is_fallback: false
    });
  } catch (err: any) {
    return NextResponse.json({ 
      groq_api_key: process.env.GROQ_API_KEY || "",
      groq_model: "llama-3.3-70b-versatile",
      is_fallback: true,
      error: err.message 
    });
  }
}

export async function POST(req: Request) {
  try {
    const { groq_api_key, groq_model } = await req.json();
    
    const updates = [];
    if (groq_api_key !== undefined) {
      updates.push({ key: "groq_api_key", value: groq_api_key, updated_at: new Date().toISOString() });
    }
    if (groq_model !== undefined) {
      updates.push({ key: "groq_model", value: groq_model, updated_at: new Date().toISOString() });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: "No settings parameters provided" }, { status: 400 });
    }

    const { error } = await supabase
      .from("settings")
      .upsert(updates);

    if (error) {
      return NextResponse.json({ 
        error: `Could not save to settings table: ${error.message}. Please run scripts/init_schema.sql in your Supabase SQL Editor.` 
      }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
