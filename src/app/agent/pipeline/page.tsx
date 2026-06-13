"use client";

import { useState, useEffect } from "react";
import { Loader2, KanbanSquare, PhoneCall, Globe, MessageCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import { getLeadScoreBadge } from "@/utils/scoring";

const COLUMNS = ['New', 'Connected', 'Follow up', 'Meeting Scheduled', 'Closed', 'Not Interested'];

export default function AgentPipeline() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('assigned_to', user.id)
      .order('created_at', { ascending: false });

    if (data) setLeads(data);
    setLoading(false);
  };

  const handleDragStart = (e: React.DragEvent, lead: any) => {
    setDraggedLead(lead);
    e.dataTransfer.effectAllowed = "move";
    // For visual styling
    setTimeout(() => {
       (e.target as HTMLElement).classList.add("opacity-50");
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).classList.remove("opacity-50");
    setDraggedLead(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    if (!draggedLead || draggedLead.status === targetColumn) return;

    // Optimistic UI update
    setLeads(prev => prev.map(l => l.id === draggedLead.id ? { ...l, status: targetColumn } : l));

    // DB update
    const { error } = await supabase
      .from('leads')
      .update({ status: targetColumn })
      .eq('id', draggedLead.id);

    if (error) {
       alert("Error updating lead status: " + error.message);
       fetchLeads(); // Revert
    }
  };

  return (
    <div className="p-8 max-w-[1800px] mx-auto h-[calc(100vh-64px)] flex flex-col">
      <div className="mb-8 shrink-0">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-500 flex items-center gap-3">
          <KanbanSquare className="w-8 h-8 text-emerald-400" /> My Pipeline
        </h1>
        <p className="text-gray-400 mt-1">Drag and drop leads to instantly update their status.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 text-emerald-400">
           <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 items-start h-full">
           {COLUMNS.map(column => {
              const columnLeads = leads.filter(l => (l.status || 'New') === column || (column === 'Connected' && ['No Answer', 'Busy'].includes(l.status)));
              
              return (
                 <div 
                   key={column} 
                   className="min-w-[320px] w-[320px] bg-[#111] border border-gray-800 rounded-2xl p-4 flex flex-col h-full max-h-full"
                   onDragOver={handleDragOver}
                   onDrop={(e) => handleDrop(e, column)}
                 >
                    <div className="flex justify-between items-center mb-4 pb-3 border-b border-gray-800 shrink-0">
                       <h3 className="font-bold text-gray-200">{column}</h3>
                       <span className="bg-gray-800 text-gray-400 text-xs font-bold px-2 py-1 rounded-full">{columnLeads.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2 custom-scrollbar">
                       {columnLeads.map(lead => {
                          const badge = getLeadScoreBadge(lead);
                          return (
                             <div 
                               key={lead.id}
                               draggable
                               onDragStart={(e) => handleDragStart(e, lead)}
                               onDragEnd={handleDragEnd}
                               className="bg-[#1a1a1a] border border-gray-700/50 rounded-xl p-4 cursor-grab hover:border-emerald-500/50 transition-colors shadow-lg active:cursor-grabbing"
                             >
                               <div className="flex justify-between items-start mb-2">
                                  <a href={lead.gmbUrl || '#'} target="_blank" rel="noreferrer" className="font-bold text-gray-100 hover:text-blue-400 transition-colors text-sm line-clamp-2">
                                    {lead.name}
                                  </a>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold border shrink-0 ml-2 ${badge.classes}`}>
                                     {badge.label}
                                  </span>
                               </div>
                               
                               {lead.category && <p className="text-xs text-gray-500 mb-3">{lead.category}</p>}
                               
                               <div className="flex items-center justify-between border-t border-gray-800 pt-3 mt-3">
                                  <div className="flex items-center gap-2">
                                     {lead.phone ? (
                                        <>
                                          <a href={`tel:${lead.phone}`} className="w-8 h-8 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center hover:bg-blue-500/20 transition-colors" title="Call">
                                            <PhoneCall className="w-3 h-3" />
                                          </a>
                                          <a href={getWhatsAppUrl(lead.phone, lead.name)} target="_blank" rel="noreferrer" className="w-8 h-8 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors" title="WhatsApp">
                                            <MessageCircle className="w-3 h-3" />
                                          </a>
                                        </>
                                     ) : (
                                        <span className="text-xs text-gray-600 font-medium">No Phone</span>
                                     )}
                                  </div>
                                  
                                  {lead.website && (
                                     <a href={lead.website} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-white p-1" title="Website">
                                        <Globe className="w-4 h-4" />
                                     </a>
                                  )}
                               </div>
                             </div>
                          );
                       })}
                       {columnLeads.length === 0 && (
                          <div className="text-center p-6 border-2 border-dashed border-gray-800 rounded-xl text-gray-600 text-sm font-medium">
                             Drop here
                          </div>
                       )}
                    </div>
                 </div>
              )
           })}
        </div>
      )}
      
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}} />
    </div>
  );
}
