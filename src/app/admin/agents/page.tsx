"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, PhoneCall, TrendingUp, Loader2, Settings, Trash2, ShieldBan, ShieldCheck, XCircle, Trophy } from "lucide-react";
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
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    // Fetch Agents
    const { data: agentData } = await supabase.from('agent_profiles').select('*').order('created_at', { ascending: false });
    if (agentData) setAgents(agentData);

    // Fetch Calls for Stats
    const today = new Date();
    today.setHours(0,0,0,0);
    const { data: callsData } = await supabase
      .from('call_logs')
      .select('agent_id, created_at');

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
    setLoading(false);
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
        body: JSON.stringify({ id: selectedAgent.id, name: editName, email: editEmail, password: editPassword, role: editRole, is_active: editIsActive }),
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

  return (
    <div className="p-8 max-w-[1600px] mx-auto grid grid-cols-1 xl:grid-cols-12 gap-8">
      {/* Left Column: Create Agent */}
      <div className="xl:col-span-4 space-y-6">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Team Management</h1>
          <p className="text-gray-400 mt-1">Create new accounts and monitor performance.</p>
        </div>

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
                 <div className="w-1/2">
                    <label className="block text-gray-400 text-sm mb-2">System Role</label>
                    <select value={editRole} onChange={e => setEditRole(e.target.value)} className="w-full bg-[#1a1a1a] border border-gray-800 rounded-xl p-3 focus:border-blue-500 outline-none text-white">
                      <option value="agent">Standard Agent</option>
                      <option value="admin">System Administrator</option>
                    </select>
                 </div>
                 <div className="w-1/2">
                    <label className="block text-gray-400 text-sm mb-2">Account Status</label>
                    <button 
                      type="button" 
                      onClick={() => setEditIsActive(!editIsActive)}
                      className={`w-full flex items-center justify-center gap-2 rounded-xl py-3 border font-medium transition-colors ${editIsActive ? 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/30 hover:bg-orange-500/20'}`}
                    >
                       {editIsActive ? <ShieldCheck className="w-4 h-4" /> : <ShieldBan className="w-4 h-4" />}
                       {editIsActive ? 'Active (Can Login)' : 'Banned (Disabled)'}
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

    </div>
  );
}
