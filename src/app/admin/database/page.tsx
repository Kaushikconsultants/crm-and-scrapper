"use client";

import { useState, useEffect } from "react";
import { MapPin, Globe, Loader2, Download, Database, FileText, Filter, Users, MessageCircle, Shuffle, History } from "lucide-react";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import { getLeadScoreBadge } from "@/utils/scoring";
import LeadHistoryModal from "@/app/components/LeadHistoryModal";
import AddLeadModal from "@/app/components/AddLeadModal";
import { Plus } from "lucide-react";

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

export default function DatabasePage() {
  const [pastLeads, setPastLeads] = useState<any[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  
  // Database Filters
  const [dbFilterLoc, setDbFilterLoc] = useState("");
  const [dbFilterCat, setDbFilterCat] = useState("");
  const [dbFilterWeb, setDbFilterWeb] = useState(false);
  const [dbFilterPhone, setDbFilterPhone] = useState(false);
  const [dbFilterAssigned, setDbFilterAssigned] = useState("all");

  // Selection for Assignment
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [assigningTo, setAssigningTo] = useState<string>("");
  const [isAssigning, setIsAssigning] = useState(false);
  
  const [selectedHistoryLead, setSelectedHistoryLead] = useState<any>(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoadingPast(true);
    
    // Fetch Agents
    const { data: agentData } = await supabase.from('agent_profiles').select('*');
    if (agentData) setAgents(agentData);

    // Fetch Leads (WITHOUT the broken join)
    const { data: leadsData, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (leadsData && agentData) {
        // Manually map agent_profiles(name) into the leads object to bypass PGRST200
        const agentMap = new Map(agentData.map((a: any) => [a.id, a]));
        const enrichedLeads = leadsData.map((lead: any) => ({
            ...lead,
            agent_profiles: lead.assigned_to ? { name: agentMap.get(lead.assigned_to)?.name } : null
        }));
        setPastLeads(enrichedLeads);
    } else if (leadsData) {
        setPastLeads(leadsData);
    }
    setLoadingPast(false);
  };

  const handleAssign = async () => {
    if (!assigningTo || selectedLeads.size === 0) return;
    setIsAssigning(true);

    const { error } = await supabase
      .from('leads')
      .update({ assigned_to: assigningTo === 'unassigned' ? null : assigningTo })
      .in('id', Array.from(selectedLeads));

    setIsAssigning(false);
    if (!error) {
      setSelectedLeads(new Set());
      setAssigningTo("");
      fetchData(); // Refresh list
    } else {
      alert("Error assigning leads: " + error.message);
    }
  };

  const handleAutoDistribute = async () => {
    // Distribute selected leads, or if none selected, distribute all unassigned currently filtered
    const leadsToDistribute = selectedLeads.size > 0 
      ? filteredPastLeads.filter(l => selectedLeads.has(l.id))
      : filteredPastLeads.filter(l => !l.assigned_to);

    if (leadsToDistribute.length === 0) {
      alert("No valid unassigned leads to distribute!");
      return;
    }

    const activeAgents = agents.filter(a => a.is_active !== false);
    if (activeAgents.length === 0) {
      alert("No active agents found!");
      return;
    }

    if (!window.confirm(`Auto-distribute ${leadsToDistribute.length} leads equally across ${activeAgents.length} agents?`)) return;
    setIsAssigning(true);

    // Prepare updates
    const updates = leadsToDistribute.map((lead, index) => {
      const agent = activeAgents[index % activeAgents.length];
      return { id: lead.id, assigned_to: agent.id };
    });

    // Supabase JS doesn't have bulk update via `.update()` with different values easily without an RPC or loop
    // Since it could be hundreds, we'll do them in parallel batches of 50
    const chunkSize = 50;
    for (let i = 0; i < updates.length; i += chunkSize) {
       const chunk = updates.slice(i, i + chunkSize);
       await Promise.all(chunk.map(u => supabase.from('leads').update({ assigned_to: u.assigned_to }).eq('id', u.id)));
    }

    setIsAssigning(false);
    setSelectedLeads(new Set());
    fetchData();
    alert(`Successfully distributed ${leadsToDistribute.length} leads!`);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedLeads(newSet);
  };

  const toggleAll = (filteredLeads: any[]) => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  const filteredPastLeads = pastLeads.filter(lead => {
     if (dbFilterLoc && lead.location !== dbFilterLoc) return false;
     if (dbFilterCat && lead.category !== dbFilterCat) return false;
     if (dbFilterWeb && !lead.website) return false;
     if (dbFilterPhone && !lead.phone) return false;
     if (dbFilterAssigned === "unassigned" && lead.assigned_to) return false;
     if (dbFilterAssigned !== "all" && dbFilterAssigned !== "unassigned" && lead.assigned_to !== dbFilterAssigned) return false;
     return true;
  });

  const uniqueLocations = Array.from(new Set(pastLeads.map(l => l.location).filter(Boolean))).sort() as string[];
  const uniqueCategories = Array.from(new Set(pastLeads.map(l => l.category).filter(Boolean))).sort() as string[];

  const handleDownloadCSV = (dataToExport: any[], title: string) => {
    if (dataToExport.length === 0) return;
    const headers = ["Business Name", "Location", "Phone", "Website", "Instagram", "Facebook", "Assigned To", "Status"];
    const csvContent = [
      headers.join(","),
      ...dataToExport.map((r: any) => 
        [
          `"${(r.name || "").replace(/"/g, '""')}"`,
          `"${r.location || ""}"`,
          `"${r.phone ? `\t${r.phone}` : ""}"`,
          `"${r.website || ""}"`,
          `"${r.instagram || ""}"`,
          `"${r.facebook || ""}"`,
          `"${r.agent_profiles?.name || "Unassigned"}"`,
          `"${r.status || "New"}"`
        ].join(",")
      )
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `${title.replace(/\s+/g, '_').toLowerCase()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadPDF = (dataToExport: any[], title: string) => {
    if (dataToExport.length === 0) return;
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    
    const tableData = dataToExport.map(r => [
      r.name || '',
      r.location || '',
      r.phone || '',
      r.website || '',
      r.agent_profiles?.name || 'Unassigned',
      r.status || 'New'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Business Name', 'Location', 'Phone', 'Website', 'Assigned To', 'Status']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, overflow: 'linebreak', cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 50 }, 1: { cellWidth: 30 }, 2: { cellWidth: 35 }, 
        3: { cellWidth: 55 }, 4: { cellWidth: 30 }, 5: { cellWidth: 30 }
      },
      headStyles: { fillColor: [37, 99, 235], halign: 'center' },
      bodyStyles: { valign: 'middle' },
      margin: { top: 30, left: 14, right: 14 }
    });

    doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
  };

  return (
    <div className="p-8 max-w-[1600px] mx-auto h-full flex flex-col">
      <div className="mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Master Database</h1>
          <p className="text-gray-400 mt-1">Assign leads to agents and view your complete historical data.</p>
        </div>

        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-3 bg-blue-900/20 border border-blue-500/30 p-2 rounded-xl">
             <span className="text-blue-400 font-medium px-2">{selectedLeads.size} Selected</span>
             <select 
               value={assigningTo}
               onChange={(e) => setAssigningTo(e.target.value)}
               className="bg-[#111] border border-gray-700 text-white text-sm rounded-lg p-2 focus:outline-none"
             >
               <option value="">-- Assign To --</option>
               <option value="unassigned">Unassign</option>
               {agents.map(a => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
             </select>
             <button 
               onClick={handleAssign}
               disabled={!assigningTo || isAssigning}
               className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold"
             >
               {isAssigning ? "Working..." : "Assign / Reassign"}
             </button>
             <button 
               onClick={handleAutoDistribute}
               disabled={isAssigning}
               className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2"
               title="Distribute selected leads evenly among active agents"
             >
               <Shuffle className="w-4 h-4" /> Auto-Distribute
             </button>
          </div>
        )}
      </div>

      <div className="bg-[#111] border border-gray-800 rounded-2xl flex flex-col flex-1 overflow-hidden min-h-[600px]">
        <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-[#1a1a1a] flex-wrap gap-4">
          <div className="flex items-center gap-3 bg-[#0a0a0a] p-1.5 rounded-xl border border-gray-800 flex-wrap">
             <div className="flex items-center px-3 border-r border-gray-800">
                <Filter className="w-4 h-4 text-gray-400 mr-2" />
                <span className="text-sm text-gray-400 font-medium">Filters</span>
             </div>
             <select value={dbFilterLoc} onChange={(e) => setDbFilterLoc(e.target.value)} className="bg-transparent text-sm text-gray-300 focus:outline-none w-32 px-2 cursor-pointer">
                <option value="" className="bg-[#111] text-gray-300">All Locations</option>
                {uniqueLocations.map(loc => <option key={loc} value={loc} className="bg-[#111]">{loc}</option>)}
             </select>
             <div className="w-px h-5 bg-gray-800"></div>
             <select value={dbFilterCat} onChange={(e) => setDbFilterCat(e.target.value)} className="bg-transparent text-sm text-gray-300 focus:outline-none w-32 px-2 cursor-pointer">
                <option value="" className="bg-[#111] text-gray-300">All Categories</option>
                {uniqueCategories.map(cat => <option key={cat} value={cat} className="bg-[#111]">{cat}</option>)}
             </select>
             <div className="w-px h-5 bg-gray-800"></div>
             <select value={dbFilterAssigned} onChange={(e) => setDbFilterAssigned(e.target.value)} className="bg-transparent text-sm text-blue-400 font-medium focus:outline-none w-36 px-2 cursor-pointer">
                <option value="all" className="bg-[#111] text-gray-300">All Agents</option>
                <option value="unassigned" className="bg-[#111] text-gray-300">Unassigned Only</option>
                {agents.map(a => <option key={a.id} value={a.id} className="bg-[#111] text-gray-300">{a.name}</option>)}
             </select>
             <div className="w-px h-5 bg-gray-800"></div>
             <label className="flex items-center gap-2 cursor-pointer px-2 text-sm text-gray-300">
                <input type="checkbox" checked={dbFilterWeb} onChange={(e) => setDbFilterWeb(e.target.checked)} className="rounded border-gray-700 bg-gray-900" /> Web
             </label>
             <label className="flex items-center gap-2 cursor-pointer pr-4 text-sm text-gray-300">
                <input type="checkbox" checked={dbFilterPhone} onChange={(e) => setDbFilterPhone(e.target.checked)} className="rounded border-gray-700 bg-gray-900" /> Phone
             </label>
          </div>

          <div className="flex gap-3">
            <span className="bg-gray-800 text-gray-300 px-3 py-1.5 rounded-lg text-sm font-medium mr-2 flex items-center">
              {filteredPastLeads.length} Leads
            </span>
            <button
               onClick={() => setIsAddLeadOpen(true)}
               className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
            >
               <Plus className="w-4 h-4" /> Add Lead
            </button>
            <button onClick={() => handleDownloadCSV(filteredPastLeads, "Exported_Leads")} className="bg-[#1a1a1a] border border-gray-700 hover:bg-gray-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors"><Download className="w-4 h-4"/> CSV</button>
            <button onClick={() => handleDownloadPDF(filteredPastLeads, "Master Database")} disabled={filteredPastLeads.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50">
              <FileText className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1 w-full bg-[#0a0a0a]">
          {loadingPast ? (
            <div className="flex justify-center items-center h-full text-gray-500 gap-2"><Loader2 className="w-5 h-5 animate-spin text-blue-500" /> Loading database...</div>
          ) : filteredPastLeads.length === 0 ? (
            <div className="flex justify-center items-center h-full text-gray-500">No leads found matching your filters.</div>
          ) : (
            <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
              <thead className="bg-[#111] text-gray-400 sticky top-0 z-10 shadow-sm border-b border-gray-800">
                <tr>
                  <th className="px-4 py-4 w-12 text-center">
                    <input 
                      type="checkbox" 
                      checked={selectedLeads.size > 0 && selectedLeads.size === filteredPastLeads.length}
                      ref={input => { if (input) input.indeterminate = selectedLeads.size > 0 && selectedLeads.size < filteredPastLeads.length; }}
                      onChange={() => toggleAll(filteredPastLeads)}
                      className="rounded border-gray-700 bg-gray-900 cursor-pointer w-4 h-4"
                    />
                  </th>
                  <th className="px-6 py-4 font-semibold w-1/4">Business Name</th>
                  <th className="px-6 py-4 font-semibold">Location</th>
                  <th className="px-6 py-4 font-semibold">Assignment / Status</th>
                  <th className="px-6 py-4 font-semibold">Phone Number</th>
                  <th className="px-6 py-4 font-semibold">Socials</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {filteredPastLeads.map((lead: any) => (
                  <tr key={lead.id} className={`hover:bg-[#1a1a1a] transition-colors group ${selectedLeads.has(lead.id) ? 'bg-blue-900/10' : ''}`}>
                    <td className="px-4 py-4 text-center">
                       <input 
                         type="checkbox" 
                         checked={selectedLeads.has(lead.id)}
                         onChange={() => toggleSelection(lead.id)}
                         className="rounded border-gray-700 bg-gray-900 cursor-pointer w-4 h-4"
                       />
                    </td>
                    <td className="px-6 py-4">
                       {lead.gmbUrl ? (
                         <a href={lead.gmbUrl} target="_blank" rel="noreferrer" className="text-gray-100 font-semibold text-base mb-1 hover:text-blue-400 whitespace-normal break-words underline decoration-blue-500/30 underline-offset-4 block">{lead.name}</a>
                       ) : <div className="text-gray-100 font-semibold text-base mb-1 whitespace-normal break-words">{lead.name}</div>}
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
                       <div className="flex flex-col gap-2 items-start">
                          {lead.assigned_to ? (
                             <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5">
                               <Users className="w-3 h-3" /> {lead.agent_profiles?.name || 'Unknown Agent'}
                             </span>
                          ) : (
                             <span className="bg-gray-800 text-gray-400 px-2 py-1 rounded-md text-xs font-medium border border-gray-700">Unassigned</span>
                          )}
                          <span className={`px-2 py-1 rounded-md text-xs font-medium border ${lead.status === 'New' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'}`}>
                            {lead.status || 'New'}
                          </span>
                       </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex items-center gap-3">
                         <div className="font-mono text-blue-400 bg-blue-500/10 inline-block px-3 py-1.5 rounded-lg border border-blue-500/20 font-medium tracking-wide">
                            {lead.phone ? `'${lead.phone}` : "No Phone"}
                         </div>
                         {lead.phone && (
                            <a href={getWhatsAppUrl(lead.phone, lead.name)} target="_blank" rel="noreferrer" className="text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 p-2 rounded-lg hover:bg-emerald-500/20 transition-colors" title="Message on WhatsApp">
                               <MessageCircle className="w-4 h-4" />
                            </a>
                         )}
                       </div>
                    </td>
                    <td className="px-6 py-4 flex gap-2 items-center flex-wrap">
                        {lead.website && <a href={lead.website} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 p-2 rounded-lg"><Globe className="w-4 h-4 text-blue-400" /></a>}
                        {lead.instagram && <a href={lead.instagram} target="_blank" rel="noreferrer" className="text-pink-400 hover:text-pink-300 bg-pink-500/10 p-2 rounded-lg hover:bg-pink-500/20"><InstagramIcon className="w-4 h-4" /></a>}
                        {lead.facebook && <a href={lead.facebook} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-400 bg-blue-500/10 p-2 rounded-lg hover:bg-blue-500/20"><FacebookIcon className="w-4 h-4" /></a>}
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

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={isAddLeadOpen}
        onClose={() => setIsAddLeadOpen(false)}
        currentUserId={undefined} // Undefined means it goes to Unassigned
        onLeadAdded={fetchData}
      />
    </div>
  );
}
