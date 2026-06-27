"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, PhoneCall, TrendingUp, Loader2, Settings, Trash2, ShieldBan, ShieldCheck, XCircle, Trophy, BarChart2, PieChart, CheckCircle2, AlertCircle, Calendar, MapPin } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AgentsPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [callStats, setCallStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  // New Agent Form
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("agent");
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Edit Agent Form
  const [selectedAgent, setSelectedAgent] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState("agent");
  const [editIsActive, setEditIsActive] = useState(true);
  const [editIsAvailable, setEditIsAvailable] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Groq Settings Form
  const [groqApiKey, setGroqApiKey] = useState("");
  const [groqModel, setGroqModel] = useState("llama-3.3-70b-versatile");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  // Tab & Analytics State
  const [activeTab, setActiveTab] = useState<"team" | "analytics" | "settings">("team");
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [scraperRuns, setScraperRuns] = useState<any[]>([]);

  // Knowledge Base State
  const [kbItems, setKbItems] = useState<any[]>([]);
  const [kbType, setKbType] = useState<"text" | "url" | "pdf">("text");
  const [kbTitle, setKbTitle] = useState("");
  const [kbContent, setKbContent] = useState("");
  const [kbUrl, setKbUrl] = useState("");
  const [kbFileName, setKbFileName] = useState("");
  const [addingKb, setAddingKb] = useState(false);
  const [kbMessage, setKbMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
    fetchSettings();
    fetchKb();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.groq_api_key) setGroqApiKey(data.groq_api_key);
      if (data.groq_model) setGroqModel(data.groq_model);
    } catch (err) {}
  };

  const fetchKb = async () => {
    try {
      const res = await fetch("/api/knowledge-base");
      const data = await res.json();
      if (data.data) {
        setKbItems(data.data);
      }
    } catch (err) {}
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groq_api_key: groqApiKey, groq_model: groqModel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update settings");
      setSettingsMessage({ type: 'success', text: "Settings saved successfully!" });
    } catch (err: any) {
      setSettingsMessage({ type: 'error', text: err.message });
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Agents
      const { data: agentData } = await supabase.from('agent_profiles').select('*').order('created_at', { ascending: false });
      if (agentData) setAgents(agentData);

      // Fetch Leads
      const { data: leadsData } = await supabase.from('leads').select('id, status, category, assigned_to, created_at');
      if (leadsData) setAllLeads(leadsData);

      // Fetch Calls for Stats & Analytics (Order by latest so today's calls aren't truncated)
      const { data: callsData } = await supabase
        .from('call_logs')
        .select('agent_id, created_at, status_marked')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (callsData) setAllCalls(callsData);

      // Fetch Scraper Runs
      const { data: runsData } = await supabase.from('scraper_runs').select('*').order('created_at', { ascending: false }).limit(6);
      if (runsData) setScraperRuns(runsData);

      const today = new Date();
      today.setHours(0,0,0,0);

      const stats: any = {};
      if (callsData) {
        callsData.forEach((call) => {
          if (!stats[call.agent_id]) stats[call.agent_id] = { today: 0, total: 0 };
          stats[call.agent_id].total += 1;
          
          const callDate = new Date(call.created_at);
          if (callDate >= today) {
            stats[call.agent_id].today += 1;
          }
        });
      }
      setCallStats(stats);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAddingKb(true);
    setKbMessage(null);
    setKbFileName(file.name);
    if (!kbTitle) {
      setKbTitle(file.name.replace(/\.[^/.]+$/, ""));
    }

    try {
      // 1. Dynamic Load PDF.js from CDN
      const loadPdfJS = () => {
        return new Promise((resolve, reject) => {
          if ((window as any).pdfjsLib) {
            resolve((window as any).pdfjsLib);
            return;
          }
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
          script.onload = () => {
            const pdfjs = (window as any).pdfjsLib;
            pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            resolve(pdfjs);
          };
          script.onerror = () => reject(new Error("Failed to load PDF library"));
          document.head.appendChild(script);
        });
      };

      const pdfjs = await loadPdfJS() as any;

      // 2. Read file as ArrayBuffer
      const reader = new FileReader();
      reader.onload = async function () {
        try {
          const typedarray = new Uint8Array(this.result as ArrayBuffer);
          const pdf = await pdfjs.getDocument(typedarray).promise;
          let text = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            text += pageText + '\n';
          }
          
          if (!text.trim()) {
            throw new Error("No text content found in PDF.");
          }

          setKbContent(text);
          setKbMessage({ type: 'success', text: `Extracted ${pdf.numPages} pages from PDF successfully! Ready to save.` });
        } catch (err: any) {
          setKbMessage({ type: 'error', text: `PDF Parse Error: ${err.message}` });
        } finally {
          setAddingKb(false);
        }
      };
      
      reader.onerror = () => {
        setKbMessage({ type: 'error', text: "Failed to read local file." });
        setAddingKb(false);
      };

      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      setKbMessage({ type: 'error', text: err.message });
      setAddingKb(false);
    }
  };

  const handleAddKb = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingKb(true);
    setKbMessage(null);

    try {
      const body = {
        type: kbType,
        title: kbTitle,
        content: kbType === 'url' ? null : kbContent,
        source_url: kbType === 'url' ? kbUrl : null,
        file_name: kbType === 'pdf' ? kbFileName : null
      };

      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save knowledge item");

      setKbMessage({ type: 'success', text: "Knowledge item added successfully!" });
      setKbTitle("");
      setKbContent("");
      setKbUrl("");
      setKbFileName("");
      fetchKb();
    } catch (err: any) {
      setKbMessage({ type: 'error', text: err.message });
    } finally {
      setAddingKb(false);
    }
  };

  const handleDeleteKb = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this knowledge source?")) return;
    try {
      const res = await fetch(`/api/knowledge-base?id=${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error("Failed to delete");
      setKbItems(prev => prev.filter(item => item.id !== id));
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage(null);

    try {
      const res = await fetch("/api/agents/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create agent");

      setMessage({ type: "success", text: "Agent successfully created!" });
      setName(""); setEmail(""); setPassword(""); setRole("agent");
      fetchData(); // refresh list
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setCreating(false);
    }
  };

  const openEditModal = (agent: any) => {
    setSelectedAgent(agent);
    setEditName(agent.name);
    setEditEmail(agent.email);
    setEditRole(agent.role);
    setEditIsActive(agent.is_active !== false); // Default true if undefined
    setEditIsAvailable(agent.is_available !== false); // Default true if undefined
    setEditPassword("");
  };

  const handleUpdateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgent) return;
    setUpdating(true);

    try {
      const res = await fetch("/api/agents/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedAgent.id, name: editName, email: editEmail, password: editPassword, role: editRole, is_active: editIsActive, is_available: editIsAvailable }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update agent");

      alert("Agent updated successfully");
      setSelectedAgent(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteAgent = async () => {
    if (!selectedAgent) return;
    if (!window.confirm(`Are you absolutely sure you want to delete ${selectedAgent.name}? This action cannot be undone.`)) return;
    setDeleting(true);

    try {
      const res = await fetch("/api/agents/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedAgent.id }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete agent");

      alert("Agent deleted successfully");
      setSelectedAgent(null);
      fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Analytics calculations
  const totalLeads = allLeads.length;
  const totalCalls = allCalls.length;
  const wonDeals = allLeads.filter(l => l.status === 'Closed').length;
  const conversionRate = totalLeads > 0 ? ((wonDeals / totalLeads) * 100).toFixed(1) : "0.0";
  const activeFollowups = allLeads.filter(l => ['Follow up', 'Meeting Scheduled'].includes(l.status)).length;

  // Funnel calculations
  const contactedCount = allLeads.filter(l => l.status && l.status !== 'New').length;
  const interactedCount = allLeads.filter(l => ['Connected', 'Follow up', 'Meeting Scheduled', 'Closed'].includes(l.status)).length;

  const getLast7DaysStats = () => {
    const stats = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      
      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dayLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const count = allCalls.filter(c => {
        const cDate = new Date(c.created_at);
        return cDate >= d && cDate < nextD;
      }).length;

      stats.push({ label: dayLabel, count });
    }
    return stats;
  };
  const last7Days = getLast7DaysStats();
  const maxCallCount = Math.max(...last7Days.map(d => d.count), 1);

  const getTopCategories = () => {
    const counts: { [key: string]: number } = {};
    allLeads.forEach(l => {
      const cat = l.category || 'General';
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  };
  const topCategories = getTopCategories();
  const maxCategoryCount = Math.max(...topCategories.map(c => c.count), 1);

  const getAgentLeaderboard = () => {
    return agents.map(agent => {
      const closedCount = allLeads.filter(l => l.assigned_to === agent.id && l.status === 'Closed').length;
      const totalAssigned = allLeads.filter(l => l.assigned_to === agent.id).length;
      const callsLogged = allCalls.filter(c => c.agent_id === agent.id).length;
      return {
        ...agent,
        closedCount,
        totalAssigned,
        callsLogged
      };
    }).sort((a, b) => b.closedCount - a.closedCount || b.callsLogged - a.callsLogged);
  };
  const leaderboard = getAgentLeaderboard();

  return (
    <div className="p-8 max-w-[1600px] mx-auto space-y-8">
      {/* Top Header / Tab Switcher */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">
            {activeTab === "team" ? "Team Management" : activeTab === "analytics" ? "Performance & Analytics" : "AI & Knowledge Settings"}
          </h1>
          <p className="text-gray-400 mt-1">
            {activeTab === "team" 
              ? "Create new accounts and monitor active agent availability." 
              : activeTab === "analytics"
              ? "Enterprise sales funnel, daily outreach volume history, and closing velocity stats."
              : "Configure Groq API settings and upload PDF, URL, or text sources to seed the cold call pitches."}
          </p>
        </div>

        <div className="flex bg-[#111] border border-gray-800 p-1 rounded-2xl shrink-0">
          <button 
            onClick={() => setActiveTab("team")}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === "team" 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Users className="w-4 h-4" /> Team Management
          </button>
          <button 
            onClick={() => setActiveTab("analytics")}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === "analytics" 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <BarChart2 className="w-4 h-4" /> Analytics & Reports
          </button>
          <button 
            onClick={() => setActiveTab("settings")}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
              activeTab === "settings" 
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" 
                : "text-gray-400 hover:text-white"
            }`}
          >
            <Settings className="w-4 h-4" /> AI & Knowledge Settings
          </button>
        </div>
      </div>

      {activeTab === "team" ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fadeIn">
          {/* Left Column: Create Agent */}
          <div className="xl:col-span-4 space-y-6">
            <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" /> Create New Account
              </h2>

              {message && (
                <div className={`p-4 rounded-xl mb-6 text-sm ${message.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                  {message.text}
                </div>
              )}

              <form onSubmit={handleCreateAgent} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Full Name</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Email Address (Login ID)</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Temporary Password</label>
                  <input type="text" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-gray-400 text-sm mb-2">System Role</label>
                  <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none">
                    <option value="agent">Standard Agent</option>
                    <option value="admin">System Administrator</option>
                  </select>
                </div>
                
                <button type="submit" disabled={creating} className="w-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 rounded-xl py-3.5 font-semibold mt-4 transition-all flex justify-center">
                  {creating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Performance Dashboard */}
          <div className="xl:col-span-8 space-y-6">
            {/* Top Performer Widget */}
            {!loading && agents.length > 0 && (
              <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-3xl p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-yellow-500/20 text-yellow-500 flex items-center justify-center font-bold relative">
                    <Trophy className="w-7 h-7" />
                    <div className="absolute -bottom-1 -right-1 bg-yellow-500 text-black text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#111]">1</div>
                  </div>
                  <div>
                    <h3 className="text-sm text-yellow-500 font-bold tracking-widest uppercase mb-1">Top Performer Today</h3>
                    {(() => {
                      const topAgent = agents.reduce((prev, current) => {
                        const prevCalls = callStats[prev.id]?.today || 0;
                        const currentCalls = callStats[current.id]?.today || 0;
                        return (currentCalls > prevCalls) ? current : prev;
                      }, agents[0]);
                      const calls = callStats[topAgent.id]?.today || 0;
                      return (
                        <p className="text-2xl font-bold text-white">
                          {topAgent.name} <span className="text-sm font-normal text-gray-400">with {calls} calls</span>
                        </p>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 flex flex-col min-h-[500px]">
              <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-400" /> Agent Performance Dashboard
              </h2>

              <div className="overflow-auto flex-1 w-full bg-[#0a0a0a] rounded-xl border border-gray-800">
                {loading ? (
                  <div className="flex justify-center items-center h-full text-gray-500"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading stats...</div>
                ) : (
                  <table className="w-full text-left text-sm border-collapse min-w-[600px]">
                    <thead className="bg-[#111] text-gray-400 sticky top-0 border-b border-gray-800">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Agent Name</th>
                        <th className="px-6 py-4 font-semibold">Role</th>
                        <th className="px-6 py-4 font-semibold text-center">Availability Status</th>
                        <th className="px-6 py-4 font-semibold text-center">Calls Made Today</th>
                        <th className="px-6 py-4 font-semibold text-center">Total Calls Logged</th>
                        <th className="px-6 py-4 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/50">
                      {agents.map((agent) => (
                        <tr key={agent.id} className="hover:bg-[#1a1a1a] transition-colors">
                          <td className="px-6 py-4 font-medium text-gray-200 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold">
                              {agent.name.charAt(0)}
                            </div>
                            <div>
                              <div>{agent.name}</div>
                              <div className="text-xs text-gray-500">{agent.email}</div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-1 rounded-md text-xs font-semibold border ${agent.role === 'admin' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                              {agent.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${agent.is_available !== false ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                              {agent.is_available !== false ? 'AVAILABLE' : 'OFFLINE'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center gap-1.5 font-mono text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg">
                              <PhoneCall className="w-3 h-3" /> {callStats[agent.id]?.today || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="font-mono text-gray-400">
                              {callStats[agent.id]?.total || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => openEditModal(agent)} className="bg-gray-800 hover:bg-gray-700 text-gray-300 p-2 rounded-lg transition-colors">
                              <Settings className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === "analytics" ? (
        /* Analytics Dashboard View */
        <div className="space-y-8 animate-fadeIn">
          {loading ? (
            <div className="flex justify-center items-center h-64 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mr-2" /> Loading analytics engine...
            </div>
          ) : (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/40 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none transition-all group-hover:bg-blue-500/10"></div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-400 flex items-center justify-center">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Leads</p>
                      <h3 className="text-3xl font-extrabold text-white mt-1 font-mono">{totalLeads}</h3>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-emerald-500/40 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-bl-full pointer-events-none transition-all group-hover:bg-emerald-500/10"></div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Overall Conversion</p>
                      <h3 className="text-3xl font-extrabold text-emerald-400 mt-1 font-mono">{conversionRate}%</h3>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-purple-500/40 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-bl-full pointer-events-none transition-all group-hover:bg-purple-500/10"></div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-500/10 text-purple-400 flex items-center justify-center">
                      <PhoneCall className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Total Logged Calls</p>
                      <h3 className="text-3xl font-extrabold text-white mt-1 font-mono">{totalCalls}</h3>
                    </div>
                  </div>
                </div>

                <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-amber-500/40 transition-all">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-bl-full pointer-events-none transition-all group-hover:bg-amber-500/10"></div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Active Follow-ups</p>
                      <h3 className="text-3xl font-extrabold text-white mt-1 font-mono">{activeFollowups}</h3>
                    </div>
                  </div>
                </div>
              </div>

              {/* Main Graphs / Funnel Area */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* 7-Day call history bar chart */}
                <div className="lg:col-span-8 bg-[#111] border border-gray-800 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-400" /> 7-Day Call History Timeline
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">Daily aggregated call volumes for active lead outreach.</p>
                  </div>

                  <div className="h-64 mt-8 flex items-end justify-between px-4 pb-2 border-b border-gray-800/80 relative">
                    {/* SVG grid lines */}
                    <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5 pr-2">
                      <div className="w-full border-t border-white"></div>
                      <div className="w-full border-t border-white"></div>
                      <div className="w-full border-t border-white"></div>
                      <div className="w-full border-t border-white"></div>
                    </div>

                    {last7Days.map((day, idx) => {
                      const percentage = (day.count / maxCallCount) * 100;
                      return (
                        <div key={idx} className="flex flex-col items-center gap-3 w-full group relative">
                          {/* Tooltip */}
                          <div className="absolute bottom-full mb-2 bg-[#1c1c1e] text-white border border-gray-800 text-[10px] font-bold px-2 py-1 rounded shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-20">
                            {day.count} Calls
                          </div>
                          
                          {/* Bar */}
                          <div className="w-12 bg-gradient-to-t from-blue-600/30 to-blue-500 rounded-t-lg transition-all duration-500 hover:brightness-125" style={{ height: `${Math.max(percentage, 5)}%` }}>
                            <div className="h-1 bg-blue-300 w-full rounded-t-lg"></div>
                          </div>

                          <span className="text-[10px] font-medium text-gray-500 group-hover:text-white transition-colors">{day.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Conversion Funnel */}
                <div className="lg:col-span-4 bg-[#111] border border-gray-800 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <PieChart className="w-5 h-5 text-purple-400" /> Lead Pipeline Conversion
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">Status conversion conversion rate mapping.</p>
                  </div>

                  {/* Funnel Layout */}
                  <div className="space-y-4 mt-8 flex-1 flex flex-col justify-center">
                    {[
                      { label: "All Leads", count: totalLeads, color: "from-blue-600 to-blue-500", pct: 100 },
                      { label: "Outreached (Called)", count: contactedCount, color: "from-indigo-600 to-indigo-500", pct: totalLeads > 0 ? Math.round((contactedCount / totalLeads) * 100) : 0 },
                      { label: "Interacted (Interested)", count: interactedCount, color: "from-purple-600 to-purple-500", pct: contactedCount > 0 ? Math.round((interactedCount / contactedCount) * 100) : 0 },
                      { label: "Won (Closed)", count: wonDeals, color: "from-emerald-600 to-emerald-500", pct: interactedCount > 0 ? Math.round((wonDeals / interactedCount) * 100) : 0 }
                    ].map((step, idx) => (
                      <div key={idx} className="relative group">
                        <div className="flex justify-between items-center text-xs mb-1.5 px-1">
                          <span className="font-semibold text-gray-300">{step.label}</span>
                          <span className="font-mono text-gray-400 font-bold">{step.count} ({step.pct}%)</span>
                        </div>
                        <div className="w-full bg-gray-900 border border-gray-800 rounded-full h-3 overflow-hidden">
                          <div className={`bg-gradient-to-r ${step.color} h-full rounded-full transition-all duration-500`} style={{ width: `${step.pct}%` }}></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Second Row: Categories, Scrapes & Top Closing Leaders */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Category statistics */}
                <div className="lg:col-span-4 bg-[#111] border border-gray-800 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <MapPin className="w-5 h-5 text-amber-400" /> Top Lead Categories
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">Lead distribution by business category niches.</p>
                  </div>

                  <div className="space-y-4 mt-6 flex-1 flex flex-col justify-center">
                    {topCategories.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center">No categories to display</p>
                    ) : (
                      topCategories.map((cat, idx) => {
                        const pct = Math.round((cat.count / maxCategoryCount) * 100);
                        return (
                          <div key={idx} className="space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="text-gray-300 font-medium">{cat.category}</span>
                              <span className="text-gray-500 font-mono font-bold">{cat.count} leads</span>
                            </div>
                            <div className="w-full bg-gray-900 border border-gray-800/80 rounded-lg h-2 overflow-hidden">
                              <div className="bg-amber-500 h-full rounded-lg" style={{ width: `${pct}%` }}></div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Scraper Run History */}
                <div className="lg:col-span-4 bg-[#111] border border-gray-800 rounded-3xl p-6 flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <BarChart2 className="w-5 h-5 text-blue-400" /> Scraper History
                    </h3>
                    <p className="text-gray-400 text-xs mt-1">Audit log of recent lead generation scrapes.</p>
                  </div>

                  <div className="space-y-3 mt-6 flex-1 overflow-y-auto max-h-56 pr-1 custom-scrollbar">
                    {scraperRuns.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-8">No runs logged yet</p>
                    ) : (
                      scraperRuns.map((run, idx) => (
                        <div key={run.id || idx} className="bg-[#1a1a1a] border border-gray-800/80 rounded-xl p-3 flex justify-between items-center hover:border-blue-500/20 transition-all">
                          <div>
                            <span className="text-xs font-bold text-gray-200 block truncate max-w-[150px]" title={run.category}>{run.category}</span>
                            <span className="text-[10px] text-gray-500 flex items-center gap-0.5 mt-0.5">
                              <MapPin className="w-2.5 h-2.5 text-gray-600" /> {run.location}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-bold border uppercase ${
                              run.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              run.status === 'Running' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {run.leads_found || 0} Leads
                            </span>
                            <span className="text-[9px] text-gray-600 block mt-1">
                              {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Deal-Closer Leaderboard */}
                <div className="lg:col-span-4 bg-[#111] border border-gray-800 rounded-3xl p-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2 mb-2">
                    <Trophy className="w-5 h-5 text-yellow-500" /> Agent Leaderboard
                  </h3>
                  <p className="text-gray-400 text-xs mb-6">Ranking agents based on closed deals.</p>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-800 text-gray-500 pb-3">
                          <th className="pb-3 font-semibold">Agent</th>
                          <th className="pb-3 font-semibold text-center">Calls</th>
                          <th className="pb-3 font-semibold text-right text-yellow-500">Won</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {leaderboard.map((agent, index) => (
                          <tr key={agent.id} className="hover:bg-white/5 transition-colors">
                            <td className="py-3 flex items-center gap-3">
                              <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                                index === 0 ? 'bg-yellow-500 text-black' : 
                                index === 1 ? 'bg-gray-300 text-black' : 
                                index === 2 ? 'bg-amber-600 text-black' : 'bg-gray-800 text-gray-400'
                              }`}>
                                {index + 1}
                              </span>
                              <div>
                                <span className="font-bold text-gray-200 block max-w-[80px] truncate">{agent.name}</span>
                              </div>
                            </td>
                            <td className="py-3 text-center font-mono text-gray-400">{agent.callsLogged}</td>
                            <td className="py-3 text-right font-mono font-bold text-emerald-400 text-sm">{agent.closedCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* AI Settings & Knowledge Base Tab */
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 animate-fadeIn">
          {/* Left Column: Groq Settings */}
          <div className="xl:col-span-4 space-y-6">
             <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group">
               <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
                 <Settings className="w-5 h-5 text-blue-400" /> AI System Settings
               </h2>

               {settingsMessage && (
                 <div className={`p-4 rounded-xl mb-6 text-sm ${settingsMessage.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                   {settingsMessage.text}
                 </div>
               )}

               <form onSubmit={handleSaveSettings} className="space-y-4">
                 <div>
                   <label className="block text-gray-400 text-sm mb-2 font-medium">Groq API Key</label>
                   <input 
                     type="password" 
                     value={groqApiKey} 
                     onChange={e => setGroqApiKey(e.target.value)} 
                     required 
                     placeholder="gsk_..."
                     className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none text-white font-mono text-sm" 
                   />
                   <p className="text-[10px] text-gray-500 mt-1.5">
                     This API key is stored in the Supabase settings table and used to generate pitch offers and call scripts for agents.
                   </p>
                 </div>

                 <div>
                   <label className="block text-gray-400 text-sm mb-2 font-medium">Groq Model</label>
                   <select 
                     value={groqModel} 
                     onChange={e => setGroqModel(e.target.value)} 
                     required 
                     className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none text-white text-sm"
                   >
                     <option value="llama-3.3-70b-specdec">llama-3.3-70b-specdec (High performance reasoning)</option>
                     <option value="llama-3.3-70b-versatile">llama-3.3-70b-versatile (Recommended default)</option>
                     <option value="llama-3.1-70b-versatile">llama-3.1-70b-versatile (General purpose large)</option>
                     <option value="llama-3.1-8b-instant">llama-3.1-8b-instant (Fast / lightweight)</option>
                     <option value="gemma2-9b-it">gemma2-9b-it (Google Gemma 2)</option>
                     <option value="mixtral-8x7b-32768">mixtral-8x7b-32768 (MoE architecture)</option>
                   </select>
                 </div>
                 
                 <button 
                   type="submit" 
                   disabled={savingSettings} 
                   className="w-full bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50 rounded-xl py-3.5 font-semibold mt-4 transition-all flex justify-center text-sm cursor-pointer"
                 >
                   {savingSettings ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Settings"}
                 </button>
               </form>
             </div>
          </div>

          {/* Right Column: Knowledge Base Manager */}
          <div className="xl:col-span-8 space-y-6">
             <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 relative overflow-hidden">
               <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
                 <Settings className="w-5 h-5 text-purple-400" /> AI Knowledge Base
               </h2>
               <p className="text-gray-400 text-xs mb-6">Upload PDFs, reference websites/URLs, or type raw guidelines to seed client offers and script generation context.</p>

               {kbMessage && (
                 <div className={`p-4 rounded-xl mb-6 text-sm ${kbMessage.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-green-500/10 text-green-400 border border-green-500/20'}`}>
                   {kbMessage.text}
                 </div>
               )}

               <form onSubmit={handleAddKb} className="space-y-6">
                 {/* Source Type Selector */}
                 <div>
                   <label className="block text-gray-400 text-sm mb-2.5 font-semibold">Knowledge Source Type</label>
                   <div className="grid grid-cols-3 gap-3">
                     {[
                       { value: "text", label: "Raw Text / Guidelines" },
                       { value: "url", label: "Website / URL Source" },
                       { value: "pdf", label: "PDF Document Upload" }
                     ].map(opt => (
                       <button
                         key={opt.value}
                         type="button"
                         onClick={() => {
                           setKbType(opt.value as any);
                           setKbMessage(null);
                         }}
                         className={`py-3 rounded-xl border text-sm font-semibold transition-all ${
                           kbType === opt.value 
                             ? "bg-purple-600/15 border-purple-500 text-purple-300"
                             : "bg-[#1a1a1a] border-gray-800 text-gray-400 hover:text-white"
                         }`}
                       >
                         {opt.label}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Title Input */}
                 <div>
                   <label className="block text-gray-400 text-sm mb-2 font-medium">Document / Source Title</label>
                   <input 
                     type="text" 
                     value={kbTitle} 
                     onChange={e => setKbTitle(e.target.value)} 
                     required 
                     placeholder="e.g. Hyperscript Web Development Catalog" 
                     className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-purple-500 outline-none text-white text-sm"
                   />
                 </div>

                 {/* Conditional Fields based on KB Type */}
                 {kbType === "text" && (
                   <div className="animate-fadeIn">
                     <label className="block text-gray-400 text-sm mb-2 font-medium">Raw Guidelines / Text Content</label>
                     <textarea
                       rows={6}
                       value={kbContent}
                       onChange={e => setKbContent(e.target.value)}
                       required
                       placeholder="Paste service catalogs, business details, or pitch instructions..."
                       className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-purple-500 outline-none text-white text-sm font-mono"
                     />
                   </div>
                 )}

                 {kbType === "url" && (
                   <div className="animate-fadeIn space-y-4">
                     <div>
                       <label className="block text-gray-400 text-sm mb-2 font-medium">Website URL</label>
                       <input 
                         type="url" 
                         value={kbUrl} 
                         onChange={e => setKbUrl(e.target.value)} 
                         required 
                         placeholder="https://example.com/services" 
                         className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-purple-500 outline-none text-white text-sm font-mono"
                       />
                     </div>
                     <p className="text-[10px] text-gray-500">Note: The AI agent will refer to this URL link as context to tailor services and pitches for your team.</p>
                   </div>
                 )}

                 {kbType === "pdf" && (
                   <div className="animate-fadeIn space-y-4">
                     <div>
                       <label className="block text-gray-400 text-sm mb-2 font-medium">Choose PDF Document</label>
                       <input 
                         type="file" 
                         accept="application/pdf"
                         onChange={handlePdfUpload}
                         className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 file:bg-purple-600 file:border-none file:text-white file:px-3 file:py-1.5 file:rounded-lg file:text-xs file:font-bold file:mr-4 file:cursor-pointer text-gray-400 text-sm cursor-pointer"
                       />
                     </div>

                     {kbContent && (
                       <div className="space-y-2">
                         <label className="block text-emerald-400 text-xs font-semibold">Extracted PDF Text Preview</label>
                         <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-3 max-h-48 overflow-y-auto text-xs font-mono text-gray-400 whitespace-pre-wrap">
                           {kbContent}
                         </div>
                       </div>
                     )}
                   </div>
                 )}

                 <button
                   type="submit"
                   disabled={addingKb || (kbType === "pdf" && !kbContent) || (kbType === "url" && !kbUrl) || (kbType === "text" && !kbContent)}
                   className="w-full bg-purple-600 text-white hover:bg-purple-500 disabled:opacity-50 rounded-xl py-3.5 font-semibold mt-4 transition-all flex justify-center text-sm cursor-pointer"
                 >
                   {addingKb ? <Loader2 className="w-5 h-5 animate-spin" /> : "Add Knowledge Source"}
                 </button>
               </form>
             </div>

             {/* Existing Knowledge Sources List */}
             <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 relative overflow-hidden">
               <h3 className="text-lg font-bold text-white mb-6">Active Knowledge Sources</h3>
               
               {kbItems.length === 0 ? (
                 <div className="text-center py-8 text-gray-500 text-sm">No knowledge items uploaded yet.</div>
               ) : (
                 <div className="overflow-x-auto">
                   <table className="w-full text-left text-xs border-collapse">
                     <thead>
                       <tr className="border-b border-gray-800 text-gray-500 pb-3">
                         <th className="pb-3 font-semibold">Type</th>
                         <th className="pb-3 font-semibold">Source Title</th>
                         <th className="pb-3 font-semibold">Source Details</th>
                         <th className="pb-3 font-semibold text-right">Action</th>
                       </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-800/50">
                       {kbItems.map(item => (
                         <tr key={item.id} className="hover:bg-white/5 transition-colors">
                           <td className="py-3">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold border uppercase ${
                               item.type === 'pdf' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                               item.type === 'url' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                               'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                             }`}>
                               {item.type}
                             </span>
                           </td>
                           <td className="py-3 font-bold text-gray-200">{item.title}</td>
                           <td className="py-3 text-gray-400 max-w-xs truncate font-mono">
                             {item.type === 'url' ? item.source_url : item.file_name || (item.content ? item.content.slice(0, 50) + "..." : "")}
                           </td>
                           <td className="py-3 text-right">
                             <button
                               onClick={() => handleDeleteKb(item.id)}
                               className="text-red-500 hover:text-red-400 p-1.5 rounded transition-colors"
                             >
                               <Trash2 className="w-4 h-4" />
                             </button>
                           </td>
                         </tr>
                       ))}
                     </tbody>
                   </table>
                 </div>
               )}
             </div>
          </div>
        </div>
      )}

      {/* Edit Agent Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-[#111] border border-gray-800 rounded-3xl p-6 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => setSelectedAgent(null)} className="absolute top-4 right-4 text-gray-500 hover:text-white">
              <XCircle className="w-6 h-6" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-6">Manage Agent: {selectedAgent.name}</h2>

            <form onSubmit={handleUpdateAgent} className="space-y-4">
              <div>
                <label className="block text-gray-400 text-sm mb-2">Full Name</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} required className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none text-white" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Login Email Address</label>
                <input type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} required className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none text-white" />
              </div>
              <div>
                <label className="block text-gray-400 text-sm mb-2">Reset Password <span className="text-gray-600 text-xs">(Leave blank to keep current)</span></label>
                <input type="text" value={editPassword} onChange={e => setEditPassword(e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none text-white" placeholder="New password" />
              </div>
              <div className="flex gap-4">
                 <div className="w-1/3">
                    <label className="block text-gray-400 text-sm mb-2">System Role</label>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none text-white text-sm">
                      <option value="agent">Standard Agent</option>
                      <option value="admin">System Administrator</option>
                    </select>
                 </div>
                 <div className="w-1/3">
                    <label className="block text-gray-400 text-sm mb-2">Account Status</label>
                    <button 
                      type="button" 
                      onClick={() => setEditIsActive(!editIsActive)}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-3 border text-xs font-medium transition-colors ${editIsActive ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'}`}
                    >
                       {editIsActive ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldBan className="w-3.5 h-3.5" />}
                       {editIsActive ? 'Active' : 'Banned'}
                    </button>
                 </div>
                 <div className="w-1/3">
                    <label className="block text-gray-400 text-sm mb-2">Availability</label>
                    <button 
                      type="button" 
                      onClick={() => setEditIsAvailable(!editIsAvailable)}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-3 border text-xs font-medium transition-colors ${editIsAvailable ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/30 hover:bg-rose-500/20'}`}
                    >
                       {editIsAvailable ? '✓ Available' : '✗ Offline'}
                    </button>
                 </div>
              </div>
              
              <div className="flex gap-3 pt-4 mt-6 border-t border-gray-800">
                <button type="button" onClick={handleDeleteAgent} disabled={deleting || updating} className="flex-1 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/30 rounded-xl py-3 font-semibold transition-all flex justify-center items-center gap-2">
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete Agent</>}
                </button>
                <button type="submit" disabled={updating || deleting} className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 rounded-xl py-3 font-semibold transition-all flex justify-center">
                  {updating ? <Loader2 className="w-5 h-5 animate-spin" /> : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global CSS for Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out forwards;
        }
      `}} />
    </div>
  );
}
