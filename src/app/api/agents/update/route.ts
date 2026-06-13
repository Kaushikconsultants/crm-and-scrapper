import { NextResponse } from "next/dist/server/web/exports";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
       return NextResponse.json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || "");

    const { id, email, password, name, role, is_active } = await req.json();

    if (!id || !email || !name || !role) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 1. Update Auth User
    const authUpdates: any = { email };
    if (password && password.trim() !== "") {
        authUpdates.password = password;
    }

    // Ban or Unban user
    if (typeof is_active === "boolean") {
        authUpdates.ban_duration = is_active ? "none" : "876000h"; // 100 years
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
    if (authError) throw authError;

    // 2. Update Agent Profile
    const profileUpdates: any = { email, name, role };
    if (typeof is_active === "boolean") {
        profileUpdates.is_active = is_active;
    }

    const { error: profileError } = await supabaseAdmin
      .from('agent_profiles')
      .update(profileUpdates)
      .eq('id', id);

    if (profileError) throw profileError;

    return NextResponse.json({ message: "Agent updated successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
