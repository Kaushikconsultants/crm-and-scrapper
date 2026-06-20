"use client";

import { useState, useEffect } from "react";
import { PhoneCall, CalendarClock, Globe, MapPin, Loader2, CheckCircle2, XCircle, MessageCircle, History, Trophy, Target, Search, Plus } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import { getLeadScoreBadge } from "@/utils/scoring";
import CustomerProfileModal from "@/app/components/CustomerProfileModal";
import AddLeadModal from "@/app/components/AddLeadModal";

export default function AgentDashboard() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);

  // Modal State
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [status, setStatus] = useState("Called");
  const [notes, setNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [loggingCall, setLoggingCall] = useState(false);
  const [selectedHistoryLead, setSelectedHistoryLead] = useState<any>(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);

  // Gamification state
  const [myRank, setMyRank] = useState<number>(0);
  const [myCallsToday, setMyCallsToday] = useState<number>(0);
  const [totalAgents, setTotalAgents] = useState<number>(0);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUser(user);

    // 1.5 Fetch current agent profile for availability status
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profile) {
      setIsAvailable(profile.is_available !== false);
    }

    // 2. Fetch all leads explicitly assigned to this user that are not closed/uninterested
    const { data: myLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', user.id)
      .not('status', 'in', '("Closed", "Not Interested")')
      .order('created_at', { ascending: false });

    if (myLeads) setLeads(myLeads);

    // 3. Fetch Gamification Data
    const today = new Date();
    today.setHours(0,0,0,0);
    
    const { data: callsData } = await supabase
      .from('call_logs')
      .select('agent_id, created_at')
      .gte('created_at', today.toISOString());

    if (callsData) {
      const callsByAgent: Record<string, number> = {};
      callsData.forEach(call => {
          callsByAgent[call.agent_id] = (callsByAgent[call.agent_id] || 0) + 1;
      });

      const rankList = Object.entries(callsByAgent).sort((a, b) => b[1] - a[1]);
      const myIndex = rankList.findIndex(x => x[0] === user.id);
      
      setMyCallsToday(callsByAgent[user.id] || 0);
      setMyRank(myIndex !== -1 ? myIndex + 1 : rankList.length + 1);
      setTotalAgents(Math.max(rankList.length, 1)); // Estimate total active today
    }
    setLoading(false);
  };

  const toggleAvailability = async () => {
    if (!currentUser) return;
    const newStatus = !isAvailable;
    setIsAvailable(newStatus);
    const { error } = await supabase
      .from('agent_profiles')
      .update({ is_available: newStatus })
      .eq('id', currentUser.id);
    if (error) {
      alert("Error updating availability: " + error.message);
      setIsAvailable(!newStatus); // Revert
    }
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !currentUser) return;
    setLoggingCall(true);

    if (status === "Follow up" && (!followUpDate || !followUpTime)) {
      alert("Both Follow-up Date and Time are required!");
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
    setStatus("Called");
    setNotes("");
    setFollowUpDate("");
    setFollowUpTime("");
    fetchData(); // Refresh list (it might disappear if it's a future follow-up)
  };

  const filteredLeads = leads.filter(lead => 
    lead.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Header & Gamification */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500 flex items-center gap-3">
            My Workspace
            <button 
              onClick={toggleAvailability}
              className={`text-xs px-3 py-1.5 rounded-full font-bold border transition-colors cursor-pointer ${isAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'}`}
            >
              {isAvailable ? '● Available for Today' : '○ Offline for Today'}
            </button>
          </h1>
          <p className="text-gray-400 mt-1">Manage your explicitly assigned leads.</p>
        </div>
        
        {/* Gamification Widget */}
        <div className="bg-[#111] border border-gray-800 rounded-2xl p-4 flex items-center gap-6 shadow-lg">
           <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center">
                 <Trophy className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Current Rank</p>
                 <p className="text-xl font-bold text-white">#{myRank} <span className="text-sm font-normal text-gray-500">/ {totalAgents}</span></p>
              </div>
           </div>
           <div className="w-px h-10 bg-gray-800"></div>
           <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
                 <Target className="w-6 h-6" />
              </div>
              <div>
                 <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Calls Today</p>
                 <p className="text-xl font-bold text-white">{myCallsToday}</p>
              </div>
           </div>
        </div>
      </div>

      {/* Main Board */}
      <div className="bg-[#111] border border-gray-800 rounded-2xl overflow-hidden flex flex-col min-h-[600px]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a]">
           <h3 className="font-semibold text-white flex items-center gap-2">
             <PhoneCall className="w-5 h-5 text-emerald-500" /> Action Required ({leads.length})
           </h3>
           <div className="flex items-center gap-4">
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
               <input 
                 type="text"
                 placeholder="Search leads..."
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="bg-[#111] border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 w-64"
               />
             </div>
             <button
               onClick={() => setIsAddLeadOpen(true)}
               className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
             >
               <Plus className="w-4 h-4" /> Add Lead
             </button>
           </div>
        </div>

        <div className="overflow-auto flex-1 w-full bg-[#0a0a0a]">
          {loading ? (
             <div className="flex justify-center items-center h-full text-gray-500 gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Loading your queue...</div>
          ) : filteredLeads.length === 0 ? (
             <div className="flex flex-col justify-center items-center h-full text-gray-500 gap-3">
               <CheckCircle2 className="w-12 h-12 text-emerald-500/50" />
               <p>Your queue is empty! Great job.</p>
             </div>
          ) : (
            <table className="w-full text-left text-sm border-collapse min-w-[800px]">
              <thead className="bg-[#111] text-gray-400 sticky top-0 border-b border-gray-800">
                <tr>
                  <th className="px-6 py-4 font-semibold w-1/3">Business Details</th>
                  <th className="px-6 py-4 font-semibold">Contact Info</th>
                  <th className="px-6 py-4 font-semibold">Current Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-[#1a1a1a] transition-colors">
                    <td className="px-6 py-4">
                       {lead.gmbUrl ? (
                          <a href={lead.gmbUrl} target="_blank" rel="noreferrer" className="text-white font-semibold text-base mb-1 hover:text-emerald-400 transition-colors whitespace-normal break-words underline decoration-emerald-500/30 underline-offset-4 block">
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
                           {(() => {
                              const badge = getLeadScoreBadge(lead);
                              return <span className={`px-2 py-1 rounded-md text-[10px] font-bold border ${badge.classes}`}>{badge.label}</span>
                           })()}
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
                       {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-blue-400 text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> {new URL(lead.website).hostname.replace('www.','')}</a>}
                    </td>
                    <td className="px-6 py-4">
                       <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${lead.status === 'New' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                         {lead.status || 'New'}
                       </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                         onClick={() => setSelectedLead(lead)}
                         className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
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
          <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setSelectedLead(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <XCircle className="w-6 h-6" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-1">Log Call: {selectedLead.name}</h2>
            <p className="text-sm text-gray-400 mb-6 font-mono text-emerald-400">{selectedLead.phone}</p>

            <form onSubmit={handleLogCall} className="space-y-5">
              <div>
                <label className="block text-gray-400 text-sm mb-2 font-medium">Call Outcome</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="Called (No Answer)">Called (No Answer)</option>
                  <option value="Connected">Connected</option>
                  <option value="Follow up">Follow up</option>
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
                      className="w-1/2 bg-[#1a1a1a] border border-orange-500/50 rounded-xl p-3 text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                    />
                    <input 
                      type="time" 
                      required 
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      onKeyDown={(e) => e.preventDefault()}
                      onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                      className="w-1/2 bg-[#1a1a1a] border border-orange-500/50 rounded-xl p-3 text-white focus:outline-none focus:border-orange-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-400 text-sm mb-2 font-medium">Call Notes</label>
                <textarea 
                  rows={4}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was discussed?"
                  className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 text-white focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              <button 
                type="submit" 
                disabled={loggingCall}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 rounded-xl py-3.5 font-semibold transition-all flex justify-center items-center gap-2"
              >
                {loggingCall ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5" /> Save Call Log</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile Modal */}
      {selectedHistoryLead && (
         <CustomerProfileModal lead={selectedHistoryLead} onClose={() => { setSelectedHistoryLead(null); fetchData(); }} currentUserId={currentUser?.id} />
      )}

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        currentUserId={currentUser?.id}
        onLeadAdded={fetchData}
      />
    </div>
  );
}
