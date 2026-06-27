import { useState, useEffect } from "react";
import { XCircle, Loader2, PhoneCall, Clock } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function LeadHistoryModal({ lead, onClose }: { lead: any; onClose: () => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchHistory();
  }, [lead]);

  const fetchHistory = async () => {
    setLoading(true);
    
    // Fetch logs
    const { data: { user } } = await supabase.auth.getUser();
    const activeUserId = user?.id;
    
    let isAdmin = false;
    if (activeUserId) {
      const { data: profile } = await supabase.from('agent_profiles').select('role').eq('id', activeUserId).single();
      isAdmin = profile?.role === 'admin';
    }

    let query = supabase
      .from('call_logs')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });

    if (!isAdmin && activeUserId) {
      query = query.eq('agent_id', activeUserId);
    }

    const { data: logsData } = await query;

    if (logsData && logsData.length > 0) {
      // Manually map agent names due to PGRST200 missing foreign key config
      const agentIds = Array.from(new Set(logsData.map(l => l.agent_id)));
      const { data: agents } = await supabase.from('agent_profiles').select('id, name').in('id', agentIds);
      
      const agentMap = new Map((agents || []).map(a => [a.id, a.name]));
      
      setLogs(logsData.map(log => ({
        ...log,
        agent_name: agentMap.get(log.agent_id) || "Unknown Agent"
      })));
    } else {
      setLogs([]);
    }
    
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Closed': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'Not Interested': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'Follow up': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'Scheduled': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'Connected': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      default: return 'text-gray-600 bg-gray-500/10 border-gray-500/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
      <div className="bg-white border border-gray-200 rounded-3xl w-full max-w-2xl shadow-2xl relative flex flex-col h-[80vh] max-h-[800px]">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-100 rounded-t-3xl shrink-0">
           <div>
             <h2 className="text-xl font-bold text-gray-900 mb-1">Timeline History</h2>
             <p className="text-sm text-blue-400 font-medium">{lead.name}</p>
           </div>
           <button onClick={onClose} className="text-gray-500 hover:text-gray-900 transition-colors">
             <XCircle className="w-7 h-7" />
           </button>
        </div>

        {/* Timeline Body */}
        <div className="p-6 overflow-y-auto flex-1 bg-white rounded-b-3xl">
          {loading ? (
             <div className="flex justify-center items-center h-full text-gray-500 gap-2">
               <Loader2 className="w-6 h-6 animate-spin" /> Loading timeline...
             </div>
          ) : logs.length === 0 ? (
             <div className="flex flex-col justify-center items-center h-full text-gray-600 gap-3">
               <Clock className="w-12 h-12 opacity-50" />
               <p>No call history recorded for this lead yet.</p>
             </div>
          ) : (
             <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-800 before:to-transparent">
               {logs.map((log, idx) => (
                 <div key={log.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                   {/* Icon */}
                   <div className="flex items-center justify-center w-10 h-10 rounded-full border border-gray-200 bg-white text-emerald-400 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 shadow">
                     <PhoneCall className="w-4 h-4" />
                   </div>
                   
                   {/* Card */}
                   <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-gray-200 bg-white shadow">
                     <div className="flex items-center justify-between mb-2">
                       <span className="font-bold text-gray-800">{log.agent_name}</span>
                       <time className="font-mono text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</time>
                     </div>
                     <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold border mb-3 ${getStatusColor(log.status_marked)}`}>
                        {log.status_marked}
                     </div>
                     <p className="text-sm text-gray-600 whitespace-pre-wrap">{log.notes || "No notes provided."}</p>
                   </div>
                 </div>
               ))}
             </div>
          )}
        </div>
        
      </div>
    </div>
  );
}
