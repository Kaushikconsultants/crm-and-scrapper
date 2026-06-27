"use client";

import { useState, useEffect } from "react";
import { PhoneCall, CalendarClock, Globe, MapPin, Loader2, CheckCircle2, XCircle, MessageCircle, History } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import LeadHistoryModal from "@/app/components/LeadHistoryModal";

export default function AgentFollowUps() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [selectedHistoryLead, setSelectedHistoryLead] = useState<any>(null);

  // Modal State
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [status, setStatus] = useState("Connected");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [loggingCall, setLoggingCall] = useState(false);

  const [filterDate, setFilterDate] = useState("");

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUser(user);

    // Fetch leads assigned to this agent where follow_up_date is NOT NULL
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', user.id)
      .not('follow_up_date', 'is', null)
      .order('follow_up_date', { ascending: true }); // Oldest follow-ups (overdue) first

    if (data) setLeads(data);
    setLoading(false);
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !currentUser) return;
    setLoggingCall(true);

    if (status === "Follow up" && (!followUpDate || !followUpTime)) {
      alert("Both Follow up date and time are required!");
      setLoggingCall(false);
      return;
    }

    // 1. Update Lead
    const combinedDateTime = (status === 'Follow up' || status === 'Scheduled') ? new Date(`${followUpDate}T${followUpTime}`).toISOString() : null;

    await supabase.from('leads').update({
      status,
      notes,
      follow_up_date: combinedDateTime
    }).eq('id', selectedLead.id);

    // 2. Insert Call Log
    await supabase.from('call_logs').insert({
      lead_id: selectedLead.id,
      agent_id: currentUser.id,
      status_marked: status,
      notes
    });

    setLoggingCall(false);
    setSelectedLead(null);
    setStatus("Connected");
    setNotes("");
    setFollowUpDate("");
    setFollowUpTime("");
    fetchData(); // Refresh list 
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
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-500">Scheduled Follow-ups</h1>
        <p className="text-gray-600 mt-1">Leads that require your attention today or are past due.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-100 flex-wrap gap-4">
           <h3 className="font-semibold text-gray-900 flex items-center gap-2">
             <CalendarClock className="w-5 h-5 text-orange-500" /> Pending Follow-ups ({filteredLeads.length})
           </h3>
           <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600 font-medium">Filter by Date:</span>
              <input 
                type="date" 
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                onKeyDown={(e) => e.preventDefault()}
                onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                className="bg-[#0a0a0a] border border-gray-700 text-gray-900 text-sm rounded-lg p-2 focus:outline-none focus:border-orange-500 cursor-pointer"
              />
              {filterDate && (
                 <button onClick={() => setFilterDate("")} className="text-xs text-orange-400 hover:text-orange-300">Clear</button>
              )}
           </div>
        </div>

        <div className="overflow-auto flex-1 w-full bg-[#0a0a0a]">
          {loading ? (
             <div className="flex justify-center items-center h-full text-gray-500 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading your calendar...</div>
          ) : filteredLeads.length === 0 ? (
             <div className="flex flex-col justify-center items-center h-full text-gray-500 gap-3">
               <CheckCircle2 className="w-12 h-12 text-emerald-500/50" />
               <p>No follow-ups scheduled for this date!</p>
             </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead className="bg-white text-gray-600 sticky top-0 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold w-1/3">Business Details</th>
                  <th className="px-6 py-4 font-semibold">Contact Info</th>
                  <th className="px-6 py-4 font-semibold">Scheduled For</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className={`hover:bg-gray-100 transition-colors ${isOverdue(lead.follow_up_date) ? 'bg-red-500/5' : ''}`}>
                    <td className="px-6 py-4">
                       {lead.gmbUrl ? (
                          <a href={lead.gmbUrl} target="_blank" rel="noreferrer" className="text-gray-900 font-semibold text-base mb-1 hover:text-orange-400 transition-colors whitespace-normal break-words underline decoration-orange-500/30 underline-offset-4 block">
                            {lead.name}
                          </a>
                       ) : (
                          <div className="text-gray-900 font-semibold text-base mb-1">{lead.name}</div>
                       )}
                       <div className="flex flex-col gap-1.5 items-start mt-2">
                         <button 
                           onClick={() => setSelectedHistoryLead(lead)} 
                           className="text-left hover:text-blue-400 transition-colors font-semibold group flex items-center gap-1.5 text-xs bg-gray-200/50 hover:bg-gray-200 px-2 py-1 rounded-md border border-gray-700/50"
                         >
                           <History className="w-3 h-3 text-gray-600 group-hover:text-blue-400 transition-colors" />
                           View History
                         </button>
                         <div className="flex gap-2 flex-wrap items-center mt-1">
                           {lead.source_platform && <span className="bg-gray-200 text-gray-700 border border-gray-700 px-2 py-1 rounded-md text-[10px] font-bold">{lead.source_platform}</span>}
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
                       <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold border inline-block ${isOverdue(lead.follow_up_date) ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                         {new Date(lead.follow_up_date).toLocaleString()}
                         {isOverdue(lead.follow_up_date) && " (OVERDUE)"}
                       </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                         onClick={() => setSelectedLead(lead)}
                         className="bg-orange-600 hover:bg-orange-500 text-gray-900 px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                       >
                         Log Call
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Call Logging Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setSelectedLead(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-900">
              <XCircle className="w-6 h-6" />
            </button>
            
            <h2 className="text-xl font-bold text-gray-900 mb-1">Log Follow-up: {selectedLead.name}</h2>
            <p className="text-sm text-gray-600 mb-6 font-mono text-emerald-400">{selectedLead.phone}</p>

            <form onSubmit={handleLogCall} className="space-y-5">
              <div>
                <label className="block text-gray-600 text-sm mb-2 font-medium">Outcome</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-orange-500"
                >
                  <option value="Connected">Connected</option>
                  <option value="Called (No Answer)">Called (No Answer)</option>
                  <option value="Follow up">Reschedule Follow up</option>
                  <option value="Scheduled">Meeting Scheduled</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Closed">Closed (Won)</option>
                </select>
              </div>

              {(status === "Follow up" || status === "Scheduled") && (
                <div>
                  <label className="block text-orange-400 text-sm mb-2 font-medium flex items-center gap-2">
                     <CalendarClock className="w-4 h-4" /> Next Follow-up Date & Time *
                  </label>
                  <div className="flex gap-3">
                    <input 
                      type="date" 
                      required 
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      onKeyDown={(e) => e.preventDefault()}
                      onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                      className="w-1/2 bg-gray-100 border border-orange-500/50 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                    />
                    <input 
                      type="time" 
                      required 
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      onKeyDown={(e) => e.preventDefault()}
                      onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                      className="w-1/2 bg-gray-100 border border-orange-500/50 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-600 text-sm mb-2 font-medium">Call Notes</label>
                <textarea 
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was discussed?"
                  className="w-full bg-gray-100 border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-orange-500 resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={loggingCall}
                className="w-full bg-orange-600 text-gray-900 hover:bg-orange-500 disabled:opacity-50 rounded-xl py-3.5 font-semibold transition-all flex justify-center items-center gap-2"
              >
                {loggingCall ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Save Call Log</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {selectedHistoryLead && (
         <LeadHistoryModal lead={selectedHistoryLead} onClose={() => setSelectedHistoryLead(null)} />
      )}
    </div>
  );
}
