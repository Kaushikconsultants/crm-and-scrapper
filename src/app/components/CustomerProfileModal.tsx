"use client";

import { useState, useEffect } from "react";
import { XCircle, Loader2, PhoneCall, Clock, Globe, MapPin, MessageCircle, Save, CalendarClock, Users, CheckCircle2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import { getLeadScoreBadge } from "@/utils/scoring";

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5"/>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/>
  </svg>
);

export default function CustomerProfileModal({ lead: initialLead, onClose, currentUserId, onLeadUpdate }: { lead: any; onClose: () => void; currentUserId?: string; onLeadUpdate?: (updatedLead: any) => void }) {
  const [lead, setLead] = useState(initialLead);
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  
  // Profile editing state
  const [phone, setPhone] = useState(initialLead.phone || "");
  const [website, setWebsite] = useState(initialLead.website || "");
  const [instagram, setInstagram] = useState(initialLead.instagram || "");
  const [facebook, setFacebook] = useState(initialLead.facebook || "");
  const [status, setStatus] = useState(initialLead.status || "New");
  const [savingProfile, setSavingProfile] = useState(false);

  // New Log state
  const [newLogStatus, setNewLogStatus] = useState("Called (No Answer)");
  const [newLogNotes, setNewLogNotes] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpTime, setFollowUpTime] = useState("");
  const [submittingLog, setSubmittingLog] = useState(false);

  // AI Insights State
  const [insights, setInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  const supabase = createClient();

  const fetchInsights = async () => {
    setLoadingInsights(true);
    setInsights("");
    try {
      const res = await fetch("/api/generate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead }),
      });
      const data = await res.json();
      if (data.insights) {
        setInsights(data.insights);
      } else {
        setInsights("Error: " + (data.error || "Could not fetch insights."));
      }
    } catch (e) {
      setInsights("Failed to fetch insights.");
    }
    setLoadingInsights(false);
  };

  useEffect(() => {
    fetchHistory();
  }, [lead.id]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    const { data: logsData } = await supabase
      .from('call_logs')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });

    if (logsData && logsData.length > 0) {
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
    setLoadingHistory(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);

    const { data, error } = await supabase
      .from('leads')
      .update({
        phone: phone || null,
        website: website || null,
        instagram: instagram || null,
        facebook: facebook || null,
        status
      })
      .eq('id', lead.id)
      .select()
      .single();

    setSavingProfile(false);
    if (!error && data) {
      setLead(data);
      if (onLeadUpdate) {
        onLeadUpdate(data);
      }
      alert("Customer profile details updated successfully!");
    } else {
      alert("Failed to update profile: " + (error?.message || "Unknown error"));
    }
  };

  const handleAddLog = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingLog(true);

    let activeAgentId = currentUserId;
    if (!activeAgentId) {
      const { data: { user } } = await supabase.auth.getUser();
      activeAgentId = user?.id || lead.assigned_to;
    }

    if (!activeAgentId) {
      alert("No active agent ID found. Cannot log call.");
      setSubmittingLog(false);
      return;
    }

    if ((newLogStatus === "Follow up" || newLogStatus === "Scheduled") && (!followUpDate || !followUpTime)) {
      alert("Both Follow-up Date and Time are required!");
      setSubmittingLog(false);
      return;
    }

    const combinedDateTime = (newLogStatus === 'Follow up' || newLogStatus === 'Scheduled') 
      ? new Date(`${followUpDate}T${followUpTime}`).toISOString() 
      : null;

    // 1. Update Lead Status and Follow-up details
    const { data: updatedLead, error: leadError } = await supabase
      .from('leads')
      .update({
        status: newLogStatus,
        follow_up_date: combinedDateTime
      })
      .eq('id', lead.id)
      .select()
      .single();

    if (leadError) {
      alert("Error updating lead status: " + leadError.message);
      setSubmittingLog(false);
      return;
    }

    // 2. Insert Call Log
    const { error: logError } = await supabase
      .from('call_logs')
      .insert({
        lead_id: lead.id,
        agent_id: activeAgentId,
        status_marked: newLogStatus,
        notes: newLogNotes
      });

    setSubmittingLog(false);
    if (!logError) {
      if (updatedLead) {
        setLead(updatedLead);
        setStatus(updatedLead.status);
        if (onLeadUpdate) {
          onLeadUpdate(updatedLead);
        }
      }
      setNewLogNotes("");
      setFollowUpDate("");
      setFollowUpTime("");
      fetchHistory(); // Refresh logs timeline view
      alert("Call log added and status updated!");
    } else {
      alert("Error saving call log: " + logError.message);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'Closed': return 'text-green-400 bg-green-500/10 border-green-500/30';
      case 'Not Interested': return 'text-red-400 bg-red-500/10 border-red-500/30';
      case 'Follow up': return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
      case 'Scheduled': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'Connected': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/30';
    }
  };

  const badge = getLeadScoreBadge(lead);

  return (
    <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[100] p-4 backdrop-blur-md">
      <div className="bg-[#0f0f12] border border-gray-800 rounded-3xl w-full max-w-5xl shadow-2xl relative flex flex-col h-[90vh] max-h-[850px] overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#15151b] shrink-0">
           <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-white tracking-tight">{lead.name}</h2>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${badge.classes}`}>{badge.label}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-gray-500" /> {lead.location || "No Location Specified"}
                <span className="text-gray-600">|</span>
                <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded-md text-xs font-semibold">{lead.category || "General"}</span>
              </p>
           </div>
           <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
              <XCircle className="w-8 h-8" />
           </button>
        </div>

        {/* Timeline & Details Split Pane */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* LEFT PANE: Customer Info Editor */}
          <div className="w-full md:w-1/2 p-6 overflow-y-auto border-r border-gray-800 flex flex-col justify-between bg-[#111115]">
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <h3 className="text-base font-bold text-gray-300 border-b border-gray-800/50 pb-2 uppercase tracking-wider">Customer Profile Details</h3>
              
              <div>
                <label className="block text-gray-400 text-xs mb-1.5 font-medium">Business Lead Status</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#1a1a24] border border-gray-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="New">New Lead</option>
                  <option value="Called">Called (No Answer)</option>
                  <option value="Connected">Connected</option>
                  <option value="Follow up">Follow up Required</option>
                  <option value="Scheduled">Meeting Scheduled</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Closed">Closed (Won)</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1.5 font-medium">Phone Number</label>
                <input 
                  type="text" 
                  value={phone} 
                  onChange={(e) => setPhone(e.target.value)} 
                  className="w-full bg-[#1a1a24] border border-gray-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500 font-mono" 
                  placeholder="e.g. 9876543210"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1.5 font-medium">Website Address</label>
                <input 
                  type="text" 
                  value={website} 
                  onChange={(e) => setWebsite(e.target.value)} 
                  className="w-full bg-[#1a1a24] border border-gray-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500" 
                  placeholder="https://example.com"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1.5 font-medium">Instagram Link</label>
                <input 
                  type="text" 
                  value={instagram} 
                  onChange={(e) => setInstagram(e.target.value)} 
                  className="w-full bg-[#1a1a24] border border-gray-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500" 
                  placeholder="https://instagram.com/handle"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-xs mb-1.5 font-medium">Facebook Link</label>
                <input 
                  type="text" 
                  value={facebook} 
                  onChange={(e) => setFacebook(e.target.value)} 
                  className="w-full bg-[#1a1a24] border border-gray-800 rounded-xl p-2.5 text-sm text-white focus:outline-none focus:border-blue-500" 
                  placeholder="https://facebook.com/page"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={savingProfile}
                  className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-2.5 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" /> Save Details</>}
                </button>
              </div>
            </form>

            {/* Quick Actions Panel */}
            <div className="mt-6 border-t border-gray-800/80 pt-4">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Quick Channels</h4>
              <div className="grid grid-cols-3 gap-2">
                {lead.phone ? (
                  <a 
                    href={getWhatsAppUrl(lead.phone, lead.name)} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-400 transition-colors text-center"
                  >
                    <MessageCircle className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">WhatsApp</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-gray-800/20 border border-gray-800/50 text-gray-600 text-center cursor-not-allowed">
                    <MessageCircle className="w-5 h-5 opacity-40" />
                    <span className="text-[10px] font-semibold">WhatsApp</span>
                  </div>
                )}

                {lead.website ? (
                  <a 
                    href={lead.website} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 text-blue-400 transition-colors text-center"
                  >
                    <Globe className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">Website</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-gray-800/20 border border-gray-800/50 text-gray-600 text-center cursor-not-allowed">
                    <Globe className="w-5 h-5 opacity-40" />
                    <span className="text-[10px] font-semibold">Website</span>
                  </div>
                )}

                {lead.gmbUrl ? (
                  <a 
                    href={lead.gmbUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25 text-amber-400 transition-colors text-center"
                  >
                    <MapPin className="w-5 h-5" />
                    <span className="text-[10px] font-semibold">G-Maps</span>
                  </a>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl bg-gray-800/20 border border-gray-800/50 text-gray-600 text-center cursor-not-allowed">
                    <MapPin className="w-5 h-5 opacity-40" />
                    <span className="text-[10px] font-semibold">G-Maps</span>
                  </div>
                )}
              </div>
            </div>

            {/* AI Insights Card */}
            <div className="mt-6 border-t border-gray-800/80 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="text-xs font-bold text-gray-500 uppercase tracking-widest">✨ AI Call Insights (Groq)</h4>
                {!insights && !loadingInsights && (
                  <button 
                    onClick={fetchInsights}
                    className="bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/25 px-2 py-1 rounded text-[10px] font-bold cursor-pointer"
                  >
                    Generate Insights
                  </button>
                )}
              </div>

              {loadingInsights ? (
                <div className="flex justify-center items-center py-6 text-gray-500 text-xs gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> Analyzing lead profiles...
                </div>
              ) : insights ? (
                <div className="text-xs text-gray-300 leading-relaxed bg-[#0a0a0d] p-3.5 rounded-xl border border-gray-850 max-h-[220px] overflow-y-auto pr-1.5 whitespace-pre-wrap font-sans">
                  {insights}
                </div>
              ) : (
                <p className="text-[10px] text-gray-500 italic">Generate insights to view services to offer and a customized phone script.</p>
              )}
            </div>
          </div>

          {/* RIGHT PANE: Conversation History & Log Call Form */}
          <div className="w-full md:w-1/2 flex flex-col h-full bg-[#0a0a0d] overflow-hidden">
            
            {/* Timeline logs timeline */}
            <div className="flex-1 p-6 overflow-y-auto min-h-[250px]">
              <h3 className="text-base font-bold text-gray-300 border-b border-gray-800/50 pb-2 mb-4 uppercase tracking-wider">Conversation Log Timeline</h3>
              
              {loadingHistory ? (
                <div className="flex justify-center items-center h-48 text-gray-500 gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Loading logs...
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-48 text-gray-600 gap-2">
                  <Clock className="w-10 h-10 opacity-40" />
                  <p className="text-sm">No conversations logged yet.</p>
                </div>
              ) : (
                <div className="space-y-4 relative pl-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-850">
                  {logs.map((log) => (
                    <div key={log.id} className="relative group">
                      {/* Timeline Node */}
                      <span className="absolute -left-4 top-1.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#0a0a0d] shadow-sm"></span>
                      
                      <div className="bg-[#121217] border border-gray-850 p-3.5 rounded-xl space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-300 flex items-center gap-1">
                            <Users className="w-3 h-3 text-gray-500" /> {log.agent_name}
                          </span>
                          <span className="font-mono text-gray-500">{new Date(log.created_at).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center pt-1.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(log.status_marked)}`}>
                            {log.status_marked}
                          </span>
                        </div>
                        <p className="text-sm text-gray-400 mt-2 whitespace-pre-wrap break-words">{log.notes || "No call notes."}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Log Call Form */}
            <div className="p-6 border-t border-gray-850 bg-[#121217] shrink-0">
              <form onSubmit={handleAddLog} className="space-y-4">
                <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wide flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-emerald-500" /> Add New Conversation Log
                </h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-gray-400 text-[10px] mb-1 font-medium">Outcome</label>
                    <select 
                      value={newLogStatus} 
                      onChange={(e) => setNewLogStatus(e.target.value)}
                      className="w-full bg-[#1c1c24] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Called (No Answer)">Called (No Answer)</option>
                      <option value="Connected">Connected</option>
                      <option value="Follow up">Follow up</option>
                      <option value="Scheduled">Meeting Scheduled</option>
                      <option value="Not Interested">Not Interested</option>
                      <option value="Closed">Closed (Won)</option>
                    </select>
                  </div>

                  {(newLogStatus === "Follow up" || newLogStatus === "Scheduled") && (
                    <div className="col-span-2 grid grid-cols-2 gap-2 mt-1">
                      <div>
                        <label className="block text-orange-400 text-[10px] mb-1 font-medium flex items-center gap-1">
                          <CalendarClock className="w-3.5 h-3.5" /> Date *
                        </label>
                        <input 
                          type="date" 
                          required 
                          value={followUpDate}
                          onChange={(e) => setFollowUpDate(e.target.value)}
                          onKeyDown={(e) => e.preventDefault()}
                          onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                          className="w-full bg-[#1c1c24] border border-orange-500/40 rounded-lg p-2 text-xs text-white focus:outline-none cursor-pointer"
                        />
                      </div>
                      <div>
                        <label className="block text-orange-400 text-[10px] mb-1 font-medium flex items-center gap-1">
                          <CalendarClock className="w-3.5 h-3.5" /> Time *
                        </label>
                        <input 
                          type="time" 
                          required 
                          value={followUpTime}
                          onChange={(e) => setFollowUpTime(e.target.value)}
                          onKeyDown={(e) => e.preventDefault()}
                          onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                          className="w-full bg-[#1c1c24] border border-orange-500/40 rounded-lg p-2 text-xs text-white focus:outline-none cursor-pointer"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-gray-400 text-[10px] mb-1 font-medium">Interaction Notes</label>
                  <textarea 
                    rows={2}
                    value={newLogNotes}
                    onChange={(e) => setNewLogNotes(e.target.value)}
                    placeholder="Enter call notes or next steps..."
                    className="w-full bg-[#1c1c24] border border-gray-800 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-emerald-500 resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={submittingLog}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl py-2 text-xs font-semibold transition-colors flex justify-center items-center gap-1.5"
                >
                  {submittingLog ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Save Log & Update Lead</>}
                </button>
              </form>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
