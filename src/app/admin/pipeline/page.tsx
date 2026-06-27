"use client";

import { useState, useEffect } from "react";
import { Loader2, KanbanSquare, PhoneCall, Globe, MessageCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import { getLeadScoreBadge } from "@/utils/scoring";

const COLUMNS = ['New', 'Connected', 'Follow up', 'Meeting Scheduled', 'Closed', 'Not Interested'];

export default function AdminPipeline() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedLead, setDraggedLead] = useState<any>(null);

  const supabase = createClient();

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);

    const { data } = await supabase
      .from('leads')
      .select('*')
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
    <div className="p-4 max-w-[1800px] mx-auto h-[calc(100vh-64px)] flex flex-col space-y-2">
      <div className="shrink-0">
        <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 flex items-center gap-2">
          <KanbanSquare className="w-6 h-6 text-blue-400" /> Global Pipeline
        </h1>
        <p className="text-gray-600 text-xs mt-0.5">Drag and drop leads to instantly update their status across the organization.</p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64 text-emerald-400">
           <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : (
        <div className="flex-1 flex gap-4 overflow-x-auto pb-2 items-start h-full min-h-0">
            {COLUMNS.map(column => {
              const columnLeads = leads.filter(l => (l.status || 'New') === column || (column === 'Connected' && ['No Answer', 'Busy'].includes(l.status)));
              
              return (
                 <div 
                   key={column} 
                   className="min-w-[260px] w-[260px] bg-white border border-gray-200 rounded-xl p-3 flex flex-col h-full max-h-full"
                   onDragOver={handleDragOver}
                   onDrop={(e) => handleDrop(e, column)}
                 >
                    <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-200 shrink-0">
                       <h3 className="font-bold text-gray-800 text-xs">{column}</h3>
                       <span className="bg-gray-200 text-gray-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{columnLeads.length}</span>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 pb-1 custom-scrollbar">
                       {columnLeads.map(lead => {
                          const badge = getLeadScoreBadge(lead);
                          return (
                             <div 
                               key={lead.id}
                               draggable
                               onDragStart={(e) => handleDragStart(e, lead)}
                               onDragEnd={handleDragEnd}
                               className="bg-gray-100 border border-gray-700/50 rounded-lg p-2.5 cursor-grab hover:border-emerald-500/50 transition-colors shadow shadow-black/40 active:cursor-grabbing"
                             >
                               <div className="flex justify-between items-start gap-1">
                                  <a href={lead.gmbUrl || '#'} target="_blank" rel="noreferrer" className="font-bold text-gray-100 hover:text-blue-400 transition-colors text-xs line-clamp-2">
                                    {lead.name}
                                  </a>
                                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold border shrink-0 ${badge.classes.split('border')[0]}`}>
                                     {badge.label}
                                  </span>
                               </div>
                               
                               {lead.category && <p className="text-[10px] text-gray-500 mt-1 mb-2">{lead.category}</p>}
                               
                               <div className="flex items-center justify-between border-t border-gray-200/80 pt-2 mt-2">
                                  <div className="flex items-center gap-1.5">
                                     {lead.phone ? (
                                        <>
                                           <a href={`tel:${lead.phone}`} className="w-6 h-6 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center hover:bg-blue-500/20 transition-colors" title="Call">
                                             <PhoneCall className="w-2.5 h-2.5" />
                                           </a>
                                           <a href={getWhatsAppUrl(lead.phone, lead.name)} target="_blank" rel="noreferrer" className="w-6 h-6 rounded bg-emerald-500/10 text-emerald-400 flex items-center justify-center hover:bg-emerald-500/20 transition-colors" title="WhatsApp">
                                             <MessageCircle className="w-2.5 h-2.5" />
                                           </a>
                                        </>
                                     ) : (
                                        <span className="text-[10px] text-gray-600 font-medium">No Phone</span>
                                     )}
                                  </div>
                                  
                                  {lead.website && (
                                     <a href={lead.website} target="_blank" rel="noreferrer" className="text-gray-600 hover:text-gray-900 p-0.5" title="Website">
                                        <Globe className="w-3.5 h-3.5 text-blue-400" />
                                     </a>
                                  )}
                               </div>
                             </div>
                          );
                       })}
                       {columnLeads.length === 0 && (
                          <div className="text-center py-4 px-2 border border-dashed border-gray-200 rounded-lg text-gray-600 text-xs font-medium">
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
        .custom-scrollbar::-webkit-scrollbar { width: 3px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}} />
    </div>
  );
}
