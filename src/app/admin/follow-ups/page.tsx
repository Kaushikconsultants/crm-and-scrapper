"use client";

import { useState, useEffect } from "react";
import { CalendarClock, MapPin, Loader2, Users, MessageCircle, History } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import CustomerProfileModal from "@/app/components/CustomerProfileModal";

export default function AdminFollowUps() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedHistoryLead, setSelectedHistoryLead] = useState<any>(null);

  const [filterDate, setFilterDate] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);

    // Fetch Agents to manually map to avoid PGRST200 foreign key error
    const { data: agentData } = await supabase.from('agent_profiles').select('*');

    // Fetch all leads where follow_up_date is NOT NULL
    const { data } = await supabase
      .from('leads')
      .select('*')
      .not('follow_up_date', 'is', null)
      .order('follow_up_date', { ascending: true }); // Oldest first

    if (data && agentData) {
        const agentMap = new Map(agentData.map((a: any) => [a.id, a]));
        const enrichedLeads = data.map((lead: any) => ({
            ...lead,
            agent_profiles: lead.assigned_to ? { name: agentMap.get(lead.assigned_to)?.name } : null
        }));
        setLeads(enrichedLeads);
    } else if (data) {
        setLeads(data);
    }
    setLoading(false);
  };

  const isOverdue = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  const filteredLeads = leads.filter(lead => {
    if (!filterDate) return true;
    const leadDate = new Date(lead.follow_up_date).toISOString().split('T')[0];
    return leadDate === filterDate;
  });

  return (
    <div className="p-4 max-w-7xl mx-auto h-full flex flex-col space-y-4">
      <div>
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">Global Follow-ups</h1>
        <p className="text-gray-600 text-xs mt-0.5">Master view of all scheduled follow-ups across your team.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-100 flex-wrap gap-3">
           <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
             <CalendarClock className="w-4 h-4 text-orange-500" /> All Scheduled Follow-ups ({filteredLeads.length})
           </h3>
           <div className="flex items-center gap-2.5">
              <span className="text-xs text-gray-600 font-medium">Filter by Date:</span>
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                onKeyDown={(e) => e.preventDefault()}
                onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                className="bg-[#0a0a0a] border border-gray-700 text-gray-900 text-xs rounded-lg p-1.5 focus:outline-none focus:border-orange-500 cursor-pointer"
              />
              {filterDate && (
                 <button onClick={() => setFilterDate("")} className="text-xs text-orange-400 hover:text-orange-300">Clear</button>
              )}
           </div>
        </div>

        <div className="overflow-auto flex-1 w-full bg-[#0a0a0a] max-h-[calc(100vh-200px)]">
          {loading ? (
             <div className="flex justify-center items-center h-full text-gray-500 gap-2"><Loader2 className="w-4 h-4 animate-spin text-orange-500" /> Loading global calendar...</div>
          ) : filteredLeads.length === 0 ? (
             <div className="flex flex-col justify-center items-center h-full text-gray-500 py-8 text-xs">
               <p>No follow-ups currently scheduled for this date.</p>
             </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse min-w-[800px] table-fixed">
              <thead className="bg-white text-gray-600 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 w-2/5">Business Name & Details</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-center w-1/4">Contact Info</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-center w-1/5">Assigned Agent</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-center w-1/5">Scheduled For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className={`hover:bg-gray-100 transition-colors ${isOverdue(lead.follow_up_date) ? 'bg-red-500/5' : ''}`}>
                    <td className="px-4 py-2.5 align-middle">
                       <div className="flex flex-col gap-0.5">
                         <div className="flex items-center gap-1.5 flex-wrap">
                           <button 
                             onClick={() => setSelectedHistoryLead(lead)} 
                             className="text-gray-900 font-semibold text-sm hover:text-orange-400 transition-colors text-left font-sans hover:underline decoration-orange-500/30 underline-offset-2"
                           >
                             {lead.name}
                           </button>
                           {lead.gmbUrl && (
                             <a href={lead.gmbUrl} target="_blank" rel="noreferrer" className="text-orange-400 hover:text-orange-300 p-0.5 rounded transition-colors shrink-0" title="View on Google Maps">
                               <MapPin className="w-3 h-3" />
                             </a>
                           )}
                         </div>
                         <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap font-medium">
                           <span className="text-purple-400/90">{lead.category || "General"}</span>
                           <span>•</span>
                           <span className="flex items-center gap-0.5 text-emerald-400/90"><MapPin className="w-2.5 h-2.5" /> {lead.location || "Haryana"}</span>
                           {lead.source_platform && (
                             <>
                               <span>•</span>
                               <span className="text-gray-600">{lead.source_platform}</span>
                             </>
                           )}
                         </div>
                       </div>
                    </td>
                    <td className="px-4 py-2.5 align-middle text-center">
                       <div className="flex items-center justify-center gap-2">
                         <div className="font-mono text-blue-400 bg-blue-500/10 inline-block px-2.5 py-1 rounded border border-blue-500/20 text-xs font-semibold tracking-wide font-mono">
                            {lead.phone || "No Phone"}
                         </div>
                         {lead.phone && (
                            <a href={getWhatsAppUrl(lead.phone, lead.name)} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 p-1.5 rounded hover:bg-emerald-500/20 transition-colors shrink-0" title="Message on WhatsApp">
                               <MessageCircle className="w-3.5 h-3.5" />
                            </a>
                         )}
                       </div>
                    </td>
                    <td className="px-4 py-2.5 align-middle text-center">
                       <div className="flex items-center justify-center gap-1.5 text-gray-700">
                          <Users className="w-3.5 h-3.5 text-emerald-400" />
                          <span className="font-medium">{lead.agent_profiles?.name || 'Unassigned'}</span>
                       </div>
                    </td>
                    <td className="px-4 py-2.5 align-middle text-center">
                       <div className={`px-2 py-1 rounded text-[11px] font-semibold border inline-block ${isOverdue(lead.follow_up_date) ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                         {new Date(lead.follow_up_date).toLocaleString()}
                         {isOverdue(lead.follow_up_date) && " (OVERDUE)"}
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Customer Profile Modal */}
      {selectedHistoryLead && (
         <CustomerProfileModal 
            lead={selectedHistoryLead} 
            onClose={() => setSelectedHistoryLead(null)} 
            onLeadUpdate={(updatedLead) => {
              setLeads(prev => prev.map(l => l.id === updatedLead.id ? { ...l, ...updatedLead } : l));
            }}
         />
      )}
    </div>
  );
}
