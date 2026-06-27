import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function check() {
  const { data: agentData } = await supabase.from('agent_profiles').select('id, name');
  const agents = {};
  if (agentData) agentData.forEach(a => agents[a.id] = a.name);

  const { data, error } = await supabase.from('call_logs').select('*');
  console.log("Total calls:", data?.length);

  const stats = {};
  data?.forEach(call => {
    const name = agents[call.agent_id] || call.agent_id;
    if (!stats[name]) stats[name] = {};
    if (!stats[name][call.status_marked]) stats[name][call.status_marked] = 0;
    stats[name][call.status_marked]++;
  });

  console.log("Stats by agent:", stats);
}
check();

