import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("settings")
      .select("*")
      .eq("key", "groq_api_key")
      .single();

    if (error) {
      // Fallback to default key if table doesn't exist yet
      return NextResponse.json({ 
        groq_api_key: process.env.GROQ_API_KEY || "",
        is_fallback: true
      });
    }

    return NextResponse.json({ 
      groq_api_key: data?.value || "",
      is_fallback: false
    });
  } catch (err: any) {
    return NextResponse.json({ 
      groq_api_key: process.env.GROQ_API_KEY || "",
      is_fallback: true,
      error: err.message 
    });
  }
}

export async function POST(req: Request) {
  try {
    const { groq_api_key } = await req.json();
    if (!groq_api_key) {
      return NextResponse.json({ error: "Missing groq_api_key" }, { status: 400 });
    }

    const { error } = await supabase
      .from("settings")
      .upsert({ key: "groq_api_key", value: groq_api_key, updated_at: new Date().toISOString() });

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
