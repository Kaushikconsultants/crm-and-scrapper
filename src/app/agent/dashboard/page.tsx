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
  const [statusFilter, setStatusFilter] = useState("all");
  const [agentName, setAgentName] = useState("");
  const [aiLanguage, setAiLanguage] = useState("English");

  // Power Dialer state
  const [isDialerActive, setIsDialerActive] = useState(false);
  const [dialerIndex, setDialerIndex] = useState(0);
  const [dialerStatus, setDialerStatus] = useState("Called (No Answer)");
  const [dialerNotes, setDialerNotes] = useState("");
  const [dialerFollowUpDate, setDialerFollowUpDate] = useState("");
  const [dialerFollowUpTime, setDialerFollowUpTime] = useState("");
  const [dialerInsights, setDialerInsights] = useState("");
  const [loadingInsights, setLoadingInsights] = useState(false);

  // Gamification state
  const [myRank, setMyRank] = useState<number>(0);
  const [myCallsToday, setMyCallsToday] = useState<number>(0);
  const [totalAgents, setTotalAgents] = useState<number>(0);

  const supabase = createClient();

  useEffect(() => {
    fetchData();

    const storedLang = localStorage.getItem("ai_outreach_language");
    if (storedLang) setAiLanguage(storedLang);

    const handleLeadUpdated = (e: Event) => {
      const updatedLead = (e as CustomEvent).detail;
      setLeads(prev => prev.map(l => l.id === updatedLead.id ? { ...l, ...updatedLead } : l));
    };

    window.addEventListener("leadUpdated", handleLeadUpdated);
    return () => window.removeEventListener("leadUpdated", handleLeadUpdated);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUser(user);

    // 1.5 Fetch current agent profile for availability status & name
    const { data: profile } = await supabase
      .from('agent_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profile) {
      setIsAvailable(profile.is_available !== false);
      setAgentName(profile.name || "");
    }

    // 2. Fetch all leads explicitly assigned to this user
    const { data: myLeads } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', user.id)
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

  const fetchDialerInsights = async (lead: any) => {
    if (!lead) return;
    setLoadingInsights(true);
    setDialerInsights("");
    try {
      // 1. Fetch Call Logs from Supabase for this lead
      const { data: logsData } = await supabase
        .from('call_logs')
        .select('status_marked, notes')
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      // 2. Call AI Insights API
      const res = await fetch("/api/generate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          lead,
          language: aiLanguage,
          agentName: agentName || "our representative",
          previousCalls: logsData || []
        }),
      });
      const data = await res.json();
      if (data.insights) {
        setDialerInsights(data.insights);
      } else {
        setDialerInsights("Error: " + (data.error || "Could not fetch insights."));
      }
    } catch (e) {
      setDialerInsights("Failed to fetch insights.");
    }
    setLoadingInsights(false);
  };

  const handleDialerLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    const currentLead = filteredLeads[dialerIndex];
    if (!currentLead || !currentUser) return;
    setLoggingCall(true);

    if (dialerStatus === "Follow up" && (!dialerFollowUpDate || !dialerFollowUpTime)) {
      alert("Both Follow-up Date and Time are required!");
      setLoggingCall(false);
      return;
    }

    const combinedDateTime = (dialerStatus === 'Follow up' || dialerStatus === 'Scheduled') ? new Date(`${dialerFollowUpDate}T${dialerFollowUpTime}`).toISOString() : null;

    // 1. Update Lead in Database
    await supabase.from('leads').update({
      status: dialerStatus,
      notes: dialerNotes,
      follow_up_date: combinedDateTime
    }).eq('id', currentLead.id);

    // 2. Insert Call Log
    await supabase.from('call_logs').insert({
      lead_id: currentLead.id,
      agent_id: currentUser.id,
      status_marked: dialerStatus,
      notes: dialerNotes
    });

    // Reset logging inputs
    setDialerStatus("Called (No Answer)");
    setDialerNotes("");
    setDialerFollowUpDate("");
    setDialerFollowUpTime("");
    setDialerInsights("");
    setLoggingCall(false);

    // Advance to next lead or complete session
    if (dialerIndex + 1 < filteredLeads.length) {
      setDialerIndex(prev => prev + 1);
    } else {
      alert("Power Dialer session complete! You have called all leads in your queue.");
      setIsDialerActive(false);
      setDialerIndex(0);
    }
    fetchData(); // Refresh lead queue
  };

  const filteredLeads = leads.filter(lead => {
    const term = searchTerm.toLowerCase();
    const nameMatch = (lead.name || "").toLowerCase().includes(term);
    const phoneMatch = (lead.phone || "").toLowerCase().includes(term);
    
    // Status filters
    let statusMatch = true;
    if (statusFilter !== "all") {
      if (statusFilter === "Called (No Answer)") {
        statusMatch = lead.status === "Called" || lead.status === "Called (No Answer)";
      } else if (statusFilter === "Connected") {
        statusMatch = lead.status === "Connected";
      } else if (statusFilter === "Follow up") {
        statusMatch = lead.status === "Follow up";
      } else if (statusFilter === "Scheduled") {
        statusMatch = lead.status === "Scheduled";
      } else if (statusFilter === "Not Interested") {
        statusMatch = lead.status === "Not Interested";
      } else if (statusFilter === "Closed") {
        statusMatch = lead.status === "Closed";
      } else if (statusFilter === "New") {
        statusMatch = lead.status === "New" || !lead.status;
      }
    }
    
    return (nameMatch || phoneMatch) && statusMatch;
  });

  return (
    <div className="p-4 max-w-[1600px] mx-auto h-full flex flex-col space-y-4">
      {/* Header & Gamification */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-blue-500 flex items-center gap-3">
            My Workspace
            <button 
              onClick={toggleAvailability}
              className={`text-xs px-2.5 py-1 rounded-full font-bold border transition-colors cursor-pointer ${isAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'}`}
            >
              {isAvailable ? '● Available' : '○ Offline'}
            </button>
          </h1>
          <p className="text-gray-600 text-xs mt-0.5">Manage your explicitly assigned leads.</p>
        </div>
        
        {/* Gamification Widget */}
        <div className="bg-white border border-gray-200 rounded-xl p-2.5 flex items-center gap-4 shadow-lg">
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center">
                 <Trophy className="w-4 h-4" />
              </div>
              <div>
                 <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Rank</p>
                 <p className="text-sm font-bold text-gray-900">#{myRank} <span className="text-[10px] font-normal text-gray-500">/ {totalAgents}</span></p>
              </div>
           </div>
           <div className="w-px h-8 bg-gray-200"></div>
           <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center">
                 <Target className="w-4 h-4" />
              </div>
              <div>
                 <p className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Calls Today</p>
                 <p className="text-sm font-bold text-gray-900">{myCallsToday}</p>
              </div>
           </div>
        </div>
      </div>

      {/* Main Board */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
        <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-100">
           <h3 className="font-semibold text-sm text-gray-900 flex items-center gap-2">
             <PhoneCall className="w-4 h-4 text-emerald-500" /> Action Required ({leads.length})
           </h3>
           <div className="flex items-center gap-3">
              <div className="relative">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                 <input 
                   type="text"
                   placeholder="Search by name or phone..."
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   className="bg-white border border-gray-200 rounded-lg pl-8 pr-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 w-56"
                 />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="New">New Leads</option>
                <option value="Called (No Answer)">Called (No Answer)</option>
                <option value="Connected">Connected</option>
                <option value="Follow up">Follow up</option>
                <option value="Scheduled">Meeting Scheduled</option>
                <option value="Not Interested">Not Interested</option>
                <option value="Closed">Closed (Won)</option>
              </select>
              <select
                value={aiLanguage}
                onChange={(e) => {
                  setAiLanguage(e.target.value);
                  localStorage.setItem("ai_outreach_language", e.target.value);
                }}
                className="bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 cursor-pointer"
                title="AI Language"
              >
                <option value="English">AI Language: English</option>
                <option value="Hindi">AI Language: Hindi</option>
                <option value="Hinglish">AI Language: Hinglish</option>
              </select>
              <button
                 onClick={() => {
                   if (filteredLeads.length === 0) {
                     alert("You have no leads in your queue to dial!");
                     return;
                   }
                   setDialerIndex(0);
                   setIsDialerActive(!isDialerActive);
                 }}
                 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${isDialerActive ? 'bg-rose-600 hover:bg-rose-500 text-white' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
              >
                 <PhoneCall className="w-3.5 h-3.5" /> {isDialerActive ? "Exit Dialer" : "Power Dialer"}
              </button>
              <button
                 onClick={() => setIsAddLeadOpen(true)}
                 className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5"
              >
                 <Plus className="w-3.5 h-3.5" /> Add Lead
              </button>
           </div>
        </div>

        <div className="overflow-auto flex-1 w-full bg-white max-h-[calc(100vh-220px)]">
          {isDialerActive ? (
            (() => {
              const currentLead = filteredLeads[dialerIndex];
              if (!currentLead) return (
                <div className="flex flex-col justify-center items-center h-full text-gray-500 gap-2 py-8">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500/50" />
                  <p className="text-xs">No active lead selected. Exit dialer to view list.</p>
                </div>
              );

              const badge = getLeadScoreBadge(currentLead);

              return (
                <div className="flex flex-col xl:flex-row h-full min-h-[500px] divide-y xl:divide-y-0 xl:divide-x divide-gray-800">
                  {/* Left Column: Lead Info and AI Pitch Insights */}
                  <div className="w-full xl:w-7/12 p-6 overflow-y-auto space-y-6">
                    <div className="flex justify-between items-start flex-wrap gap-4 border-b border-gray-200/60 pb-4">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-xl font-bold text-gray-900 tracking-tight">{currentLead.name}</h2>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badge.classes}`}>{badge.label}</span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1 flex items-center gap-1.5 flex-wrap">
                          <span className="bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded text-[10px] font-semibold">{currentLead.category || "General"}</span>
                          <span className="text-gray-700">•</span>
                          <a 
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((currentLead.location || "") + " " + currentLead.name)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300 hover:underline decoration-emerald-500/30 underline-offset-2 cursor-pointer"
                            title="Search Location on Google Maps"
                          >
                            <MapPin className="w-3 h-3" /> {currentLead.location || "Haryana"}
                          </a>
                        </p>
                      </div>

                      {/* Pagination Controls */}
                      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-1">
                        <button 
                          onClick={() => setDialerIndex(prev => Math.max(0, prev - 1))}
                          disabled={dialerIndex === 0}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                        >
                          ◀ Prev
                        </button>
                        <span className="text-xs text-gray-700 font-mono px-2">
                          {dialerIndex + 1} / {filteredLeads.length}
                        </span>
                        <button 
                          onClick={() => setDialerIndex(prev => Math.min(filteredLeads.length - 1, prev + 1))}
                          disabled={dialerIndex === filteredLeads.length - 1}
                          className="px-2 py-1 text-xs text-gray-600 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                        >
                          Next ▶
                        </button>
                      </div>
                    </div>

                    {/* Quick Channels & Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                        <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Contact details</h4>
                        <div className="space-y-1.5">
                          <div className="text-xs text-gray-700 flex justify-between">
                            <span>Phone:</span>
                            <span className="font-mono text-blue-400 font-semibold">{currentLead.phone || "No Phone"}</span>
                          </div>
                          <div className="text-xs text-gray-700 flex justify-between">
                            <span>Website:</span>
                            {currentLead.website ? (
                              <a href={currentLead.website} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline truncate max-w-[150px]">{currentLead.website}</a>
                            ) : <span>N/A</span>}
                          </div>
                        </div>
                      </div>

                      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-widest">Google maps data</h4>
                          {currentLead.gmbUrl && (
                            <a href={currentLead.gmbUrl} target="_blank" rel="noreferrer" className="text-[10px] text-emerald-400 hover:underline">View GMB</a>
                          )}
                        </div>
                        <div className="space-y-1.5">
                          <div className="text-xs text-gray-700 flex justify-between">
                            <span>Rating:</span>
                            {currentLead.gmbUrl ? (
                              <a href={currentLead.gmbUrl} target="_blank" rel="noreferrer" className="text-amber-400 font-bold hover:underline">{currentLead.rating || "N/A"} ⭐</a>
                            ) : (
                              <span className="text-amber-400 font-bold">{currentLead.rating || "N/A"} ⭐</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-700 flex justify-between">
                            <span>Reviews:</span>
                            {currentLead.gmbUrl ? (
                              <a href={currentLead.gmbUrl} target="_blank" rel="noreferrer" className="text-gray-600 hover:underline">{currentLead.reviews || "N/A"} reviews</a>
                            ) : (
                              <span className="text-gray-600">{currentLead.reviews || "N/A"} reviews</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Pitch & Script Panel */}
                    <div className="bg-[#121217] border border-gray-200 rounded-xl p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1.5">
                          ✨ AI Call Insights (Groq)
                        </h3>
                        {!dialerInsights && !loadingInsights && (
                          <button 
                            onClick={() => fetchDialerInsights(currentLead)}
                            className="bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 px-2.5 py-1 rounded text-xs font-semibold cursor-pointer"
                          >
                            Load AI Script
                          </button>
                        )}
                      </div>

                      {loadingInsights ? (
                        <div className="flex justify-center items-center py-8 text-gray-500 gap-2">
                          <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> Analyzing GMB, Website & Social profiles...
                        </div>
                      ) : dialerInsights ? (
                        <div className="text-xs text-gray-700 leading-relaxed max-h-[250px] overflow-y-auto pr-2 whitespace-pre-wrap font-sans bg-[#0a0a0d] p-3 rounded-lg border border-gray-200/80">
                          {dialerInsights}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 italic">Click the button above to analyze this lead and generate a call script.</p>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Calls-Only Dialer Form */}
                  <div className="w-full xl:w-5/12 p-6 bg-[#111115] overflow-y-auto space-y-6">
                    <h3 className="text-base font-bold text-gray-700 uppercase tracking-wider flex items-center gap-2">
                      <PhoneCall className="w-4 h-4 text-emerald-500 animate-pulse" /> Call Execution Log
                    </h3>

                    {/* Big Call Trigger */}
                    {currentLead.phone ? (
                      <a 
                        href={`tel:${currentLead.phone}`}
                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl py-4 font-bold text-center block transition-all shadow-lg hover:shadow-emerald-500/10 flex justify-center items-center gap-2 cursor-pointer"
                      >
                        <PhoneCall className="w-5 h-5" /> Click to Call: {currentLead.phone}
                      </a>
                    ) : (
                      <div className="w-full bg-gray-200 text-gray-500 rounded-xl py-4 font-bold text-center cursor-not-allowed border border-gray-700">
                        No Phone Number Available
                      </div>
                    )}

                    <form onSubmit={handleDialerLogCall} className="space-y-4 pt-4 border-t border-gray-200/60">
                      <div>
                        <label className="block text-gray-600 text-xs mb-1.5 font-medium">Call Outcome</label>
                        <select 
                          value={dialerStatus} 
                          onChange={(e) => setDialerStatus(e.target.value)}
                          className="w-full bg-[#1a1a24] border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
                        >
                          <option value="Called (No Answer)">Called (No Answer)</option>
                          <option value="Connected">Connected</option>
                          <option value="Follow up">Follow up Required</option>
                          <option value="Scheduled">Meeting Scheduled</option>
                          <option value="Not Interested">Not Interested</option>
                          <option value="Closed">Closed (Won)</option>
                        </select>
                      </div>

                      {(dialerStatus === "Follow up" || dialerStatus === "Scheduled") && (
                        <div>
                          <label className="block text-orange-400 text-xs mb-1.5 font-medium flex items-center gap-1.5">
                             <CalendarClock className="w-3.5 h-3.5" /> Next Follow-up Date & Time *
                          </label>
                          <div className="flex gap-2.5">
                            <input 
                              type="date" 
                              required 
                              value={dialerFollowUpDate}
                              onChange={(e) => setDialerFollowUpDate(e.target.value)}
                              onKeyDown={(e) => e.preventDefault()}
                              onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                              className="w-1/2 bg-[#1a1a24] border border-orange-500/50 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                            />
                            <input 
                              type="time" 
                              required 
                              value={dialerFollowUpTime}
                              onChange={(e) => setDialerFollowUpTime(e.target.value)}
                              onKeyDown={(e) => e.preventDefault()}
                              onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                              className="w-1/2 bg-[#1a1a24] border border-orange-500/50 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-gray-600 text-xs mb-1.5 font-medium">Interaction & Pitch Notes</label>
                        <textarea 
                          rows={4}
                          value={dialerNotes}
                          onChange={(e) => setDialerNotes(e.target.value)}
                          placeholder="What did they say? What was offered?"
                          className="w-full bg-[#1a1a24] border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 resize-none"
                        />
                      </div>

                      <button 
                        type="submit" 
                        disabled={loggingCall}
                        className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-gray-900 rounded-lg py-3 font-semibold transition-all flex justify-center items-center gap-1.5 text-xs cursor-pointer"
                      >
                        {loggingCall ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Save Outcome & Next Lead</>}
                      </button>
                    </form>
                  </div>
                </div>
              );
            })()
          ) : loading ? (
             <div className="flex justify-center items-center h-full text-gray-500 gap-2"><Loader2 className="w-4 h-4 animate-spin animate-spin-slow text-emerald-500" /> Loading your queue...</div>
          ) : filteredLeads.length === 0 ? (
             <div className="flex flex-col justify-center items-center h-full text-gray-500 gap-2 py-8">
               <CheckCircle2 className="w-10 h-10 text-emerald-500/50" />
               <p className="text-xs">Your queue is empty! Great job.</p>
             </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse min-w-[800px] table-fixed">
              <thead className="bg-white text-gray-600 sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 w-2/5">Business Name & Details</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-center w-1/4">Contact Info</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-center w-1/6">Status</th>
                  <th className="px-4 py-2.5 font-semibold text-gray-600 text-center w-1/6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredLeads.map((lead) => {
                  const badge = getLeadScoreBadge(lead);
                  return (
                    <tr key={lead.id} className="hover:bg-gray-100 transition-colors">
                      <td className="px-4 py-2.5 align-middle">
                         <div className="flex flex-col gap-0.5">
                           <div className="flex items-center gap-1.5 flex-wrap">
                             <button 
                               onClick={() => setSelectedHistoryLead(lead)} 
                               className="text-gray-900 font-semibold text-sm hover:text-emerald-400 transition-colors text-left font-sans hover:underline decoration-emerald-500/30 underline-offset-2"
                             >
                               {lead.name}
                             </button>
                             {lead.gmbUrl && (
                               <a href={lead.gmbUrl} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 p-0.5 rounded transition-colors shrink-0" title="View on Google Maps">
                                 <MapPin className="w-3 h-3" />
                               </a>
                             )}
                           </div>
                           <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap font-medium">
                             <span className={`font-extrabold tracking-wide ${badge.classes.split('border')[0]}`}>{badge.label}</span>
                             <span>•</span>
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
                           {lead.website && (
                             <a href={lead.website} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-gray-900 bg-white/5 hover:bg-white/10 p-1.5 rounded" title="Website">
                               <Globe className="w-3.5 h-3.5 text-blue-400" />
                             </a>
                           )}
                         </div>
                      </td>
                      <td className="px-4 py-2.5 align-middle text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-medium border ${lead.status === 'New' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                          {lead.status || 'New'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 align-middle text-center">
                        <button 
                          onClick={() => setSelectedLead(lead)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded text-xs font-semibold transition-colors"
                        >
                          Log Call
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Call Logging Modal */}
      {selectedLead && (
        <div className="fixed inset-0 bg-white/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 w-full max-w-md shadow-2xl relative">
            <button onClick={() => setSelectedLead(null)} className="absolute top-3 right-3 text-gray-500 hover:text-gray-900">
              <XCircle className="w-5 h-5" />
            </button>
            
            <h2 className="text-lg font-bold text-gray-900 mb-0.5">Log Call: {selectedLead.name}</h2>
            <p className="text-xs text-gray-600 mb-4 font-mono text-emerald-400">{selectedLead.phone}</p>

            <form onSubmit={handleLogCall} className="space-y-4">
              <div>
                <label className="block text-gray-600 text-xs mb-1.5 font-medium">Call Outcome</label>
                <select 
                  value={status} 
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500"
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
                  <label className="block text-orange-400 text-xs mb-1.5 font-medium flex items-center gap-1.5">
                     <CalendarClock className="w-3.5 h-3.5" /> Next Follow-up Date & Time *
                  </label>
                  <div className="flex gap-2.5">
                    <input 
                      type="date" 
                      required 
                      value={followUpDate}
                      onChange={(e) => setFollowUpDate(e.target.value)}
                      onKeyDown={(e) => e.preventDefault()}
                      onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                      className="w-1/2 bg-gray-100 border border-orange-500/50 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                    />
                    <input 
                      type="time" 
                      required 
                      value={followUpTime}
                      onChange={(e) => setFollowUpTime(e.target.value)}
                      onKeyDown={(e) => e.preventDefault()}
                      onClick={(e) => e.currentTarget.showPicker && e.currentTarget.showPicker()}
                      className="w-1/2 bg-gray-100 border border-orange-500/50 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-orange-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-gray-600 text-xs mb-1.5 font-medium">Call Notes</label>
                <textarea 
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What was discussed?"
                  className="w-full bg-gray-100 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-900 focus:outline-none focus:border-emerald-500 resize-none text-xs"
                />
              </div>

              <button 
                type="submit" 
                disabled={loggingCall}
                className="w-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50 rounded-lg py-2.5 font-semibold transition-all flex justify-center items-center gap-1.5 text-xs"
              >
                {loggingCall ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" /> Save Call Log</>}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Customer Profile Modal */}
      {selectedHistoryLead && (
         <CustomerProfileModal 
            lead={selectedHistoryLead} 
            onClose={() => setSelectedHistoryLead(null)} 
            currentUserId={currentUser?.id} 
            onLeadUpdate={(updatedLead) => {
              if (['Closed', 'Not Interested'].includes(updatedLead.status)) {
                setLeads(prev => prev.filter(l => l.id !== updatedLead.id));
              } else {
                setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
              }
            }}
         />
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
