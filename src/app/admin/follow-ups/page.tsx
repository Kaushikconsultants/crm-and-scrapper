"use client";

import { useState, useEffect } from "react";
import { CalendarClock, MapPin, Loader2, Users, MessageCircle, History } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import LeadHistoryModal from "@/app/components/LeadHistoryModal";

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
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">Global Follow-ups</h1>
        <p className="text-gray-400 mt-1">Master view of all scheduled follow-ups across your team.</p>
      </div>

      <div className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a] flex-wrap gap-4">
           <h3 className="font-semibold text-white flex items-center gap-2">
             <CalendarClock className="w-5 h-5 text-orange-500" /> All Scheduled Follow-ups ({filteredLeads.length})
           </h3>
           <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 font-medium">Filter by Date:</span>
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                onKeyDown={(e) => e.preventDefault()}
                onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                className="bg-[#0a0a0a] border border-gray-700 text-white text-sm rounded-lg p-2 focus:outline-none focus:border-orange-500 cursor-pointer"
              />
              {filterDate && (
                 <button onClick={() => setFilterDate("")} className="text-xs text-orange-400 hover:text-orange-300">Clear</button>
              )}
           </div>
        </div>

        <div className="overflow-auto flex-1 w-full bg-[#0a0a0a]">
          {loading ? (
             <div className="flex justify-center items-center h-full text-gray-500 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading global calendar...</div>
          ) : filteredLeads.length === 0 ? (
             <div className="flex flex-col justify-center items-center h-full text-gray-500 gap-3">
               <p>No follow-ups currently scheduled for this date.</p>
             </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead className="bg-[#111] text-gray-400 sticky top-0 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-semibold w-1/3">Business Name</th>
                  <th className="px-6 py-4 font-semibold">Contact Info</th>
                  <th className="px-6 py-4 font-semibold">Assigned Agent</th>
                  <th className="px-6 py-4 font-semibold">Scheduled For</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className={`hover:bg-[#1a1a1a] transition-colors ${isOverdue(lead.follow_up_date) ? 'bg-red-500/5' : ''}`}>
                    <td className="px-6 py-4">
                       {lead.gmbUrl ? (
                          <a href={lead.gmbUrl} target="_blank" rel="noreferrer" className="text-white font-semibold text-base mb-1 hover:text-orange-400 transition-colors whitespace-normal break-words underline decoration-orange-500/30 underline-offset-4 block">
                            {lead.name}
                          </a>
                       ) : (
                          <div className="text-white font-semibold text-base mb-1">{lead.name}</div>
                       )}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-200">
                       <div className="flex flex-col gap-1.5 items-start">
                         <button 
                           onClick={() => setSelectedHistoryLead(lead)} 
                           className="text-left hover:text-blue-400 transition-colors font-semibold group flex items-center gap-1.5 text-xs bg-gray-800/50 hover:bg-gray-800 px-2 py-1 rounded-md border border-gray-700/50"
                         >
                           <History className="w-3 h-3 text-gray-400 group-hover:text-blue-400 transition-colors" />
                           View History
                         </button>
                         <div className="flex gap-2 flex-wrap items-center mt-1">
                           {lead.source_platform && <span className="bg-gray-800 text-gray-300 border border-gray-700 px-2 py-1 rounded-md text-[10px] font-bold">{lead.source_platform}</span>}
                           {lead.category && <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-md text-[10px] font-bold">{lead.category}</span>}
                         </div>
                         {lead.location && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" /> {lead.location}</span>}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 mb-2">
                         <div className="font-mono text-emerald-400 bg-emerald-500/10 inline-block px-3 py-1.5 rounded-lg border border-emerald-500/20 font-medium w-fit">
                            {lead.phone || "No Phone"}
                         </div>
                         {lead.phone && (
                            <a href={getWhatsAppUrl(lead.phone, lead.name)} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 p-2 rounded-lg hover:bg-emerald-500/20 transition-colors" title="Message on WhatsApp">
                               <MessageCircle className="w-4 h-4" />
                            </a>
                         )}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-2 text-gray-300">
                          <Users className="w-4 h-4 text-emerald-400" />
                          {lead.agent_profiles?.name || 'Unassigned'}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-block ${isOverdue(lead.follow_up_date) ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
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

      {/* History Modal */}
      {selectedHistoryLead && (
         <LeadHistoryModal lead={selectedHistoryLead} onClose={() => setSelectedHistoryLead(null)} />
      )}
    </div>
  );
}
