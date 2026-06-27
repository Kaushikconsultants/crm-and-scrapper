import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const sql = `CREATE TABLE IF NOT EXISTS public.settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());`;
  
  // Try common RPC names
  for (const rpcName of ['exec_sql', 'run_sql', 'execute_sql']) {
    console.log(`Trying RPC: ${rpcName}...`);
    const { data, error } = await supabase.rpc(rpcName, { sql_query: sql, query: sql, sql: sql });
    console.log(`Result for ${rpcName}:`, { data, error });
  }
}

test();
