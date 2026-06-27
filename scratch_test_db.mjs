import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function test() {
  const { count, error } = await supabase
    .from('call_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log("Total call logs:", count);
}
test();
