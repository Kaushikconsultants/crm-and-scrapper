"use client";

import { useState, useEffect } from "react";
import { Search, MapPin, Globe, Loader2, Download, CheckCircle2, XCircle, FileText, Users } from "lucide-react";
import CreatableSelect from 'react-select/creatable';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { createClient } from "@/utils/supabase/client";

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

const INDIAN_LOCATIONS = [
  "Delhi", "New Delhi", "Mumbai", "Bangalore", "Hyderabad", "Chennai", "Kolkata", "Pune", "Ahmedabad", "Jaipur", "Surat",
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", 
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", 
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", 
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"
];

const locationOptions = INDIAN_LOCATIONS.map(loc => ({ label: loc, value: loc }));

const COMMON_CATEGORIES = [
  "Restaurants", "Plumbers", "Electricians", "Dentists", "Real Estate Agencies", 
  "Digital Marketing Agencies", "Salons", "Gyms", "Pharmacies", "Hotels", "Schools", "Hospitals"
];

export default function ScraperPage() {
  const [category, setCategory] = useState(COMMON_CATEGORIES[0]);
  const [location, setLocation] = useState("");
  const [maxLeads, setMaxLeads] = useState(20);
  const [statusMessage, setStatusMessage] = useState("Initializing...");
  
  const [mustHaveWebsite, setMustHaveWebsite] = useState(false);
  const [mustHaveInstagram, setMustHaveInstagram] = useState(false);
  const [mustHaveFacebook, setMustHaveFacebook] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // CRM Assignment State
  const [agents, setAgents] = useState<any[]>([]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [assigningTo, setAssigningTo] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Scraper History State
  const [scraperRuns, setScraperRuns] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    const fetchAgents = async () => {
      const { data } = await supabase.from('agent_profiles').select('*');
      if (data) setAgents(data);
    };
    fetchAgents();
    fetchScraperRuns();
  }, [supabase]);

  const fetchScraperRuns = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('scraper_runs')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) setScraperRuns(data);
    } catch (e) {
      console.error("Failed to fetch scraper runs:", e);
    }
    setLoadingHistory(false);
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedLeads);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedLeads(newSet);
  };

  const toggleAll = () => {
    const validLeads = leads.filter(l => l.id);
    if (selectedLeads.size === validLeads.length && validLeads.length > 0) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(validLeads.map(l => l.id)));
    }
  };

  const handleAssign = async () => {
    if (!assigningTo || selectedLeads.size === 0) return;
    setIsAssigning(true);
    const { error } = await supabase
      .from('leads')
      .update({ assigned_to: assigningTo })
      .in('id', Array.from(selectedLeads));

    if (!error) {
      alert(`Assigned ${selectedLeads.size} leads successfully!`);
      setSelectedLeads(new Set());
    } else {
      alert(`Error assigning: ${error.message}`);
    }
    setIsAssigning(false);
  };

  const handleDownloadCSV = (dataToExport: any[], title: string) => {
    if (dataToExport.length === 0) return;
    const headers = ["Business Name", "Rating", "Reviews", "Phone", "Website", "Instagram", "Facebook"];
    const csvContent = [
      headers.join(","),
      ...dataToExport.map((r: any) => 
        [
          `"${(r.name || "").replace(/"/g, '""')}"`,
          `"${r.rating || ""}"`,
          `"${r.reviews || ""}"`,
          `"${r.phone ? `\t${r.phone}` : ""}"`,
          `"${r.website || ""}"`,
          `"${r.instagram || ""}"`,
          `"${r.facebook || ""}"`
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
      r.category || category || '',
      r.location || location || '',
      r.phone || '',
      r.website || '',
      r.instagram ? 'Yes' : 'No',
      r.facebook ? 'Yes' : 'No'
    ]);

    autoTable(doc, {
      startY: 30,
      head: [['Business Name', 'Category', 'Location', 'Phone', 'Website', 'Insta', 'FB']],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 8, overflow: 'linebreak', cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 50 }, 1: { cellWidth: 30 }, 2: { cellWidth: 30 }, 
        3: { cellWidth: 35 }, 4: { cellWidth: 55 }, 5: { cellWidth: 15, halign: 'center' }, 6: { cellWidth: 15, halign: 'center' }
      },
      headStyles: { fillColor: [37, 99, 235], halign: 'center' },
      bodyStyles: { valign: 'middle' },
      margin: { top: 30, left: 14, right: 14 }
    });

    doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`);
  };

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setLeads([]);
    setStatusMessage("Starting engine...");

    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, location, maxLeads, mustHaveWebsite, mustHaveInstagram, mustHaveFacebook }),
      });

      if (!response.ok) throw new Error(`Failed to scrape: ${await response.text()}`);
      if (!response.body) throw new Error("ReadableStream not supported by browser.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunkString = decoder.decode(value, { stream: true });
          const lines = chunkString.split("\n").filter(line => line.trim() !== "");
          for (const line of lines) {
             try {
                const parsed = JSON.parse(line);
                if (parsed.type === "status") setStatusMessage(parsed.message);
                else if (parsed.type === "leads") setLeads(prev => [...prev, ...parsed.data]);
                else if (parsed.type === "error") setError(parsed.message);
                else if (parsed.type === "done") setStatusMessage(parsed.message);
             } catch (e) {}
          }
        }
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
    } finally {
      setLoading(false);
      fetchScraperRuns();
    }
  };

  const FilterCheckbox = ({ label, checked, onChange, icon: Icon }: any) => (
    <label className="flex items-center gap-3 cursor-pointer group">
      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${checked ? 'bg-blue-500 border-blue-500' : 'bg-gray-100 border-gray-700 group-hover:border-gray-500'}`}>
        {checked && <CheckCircle2 className="w-3 h-3 text-gray-900" />}
      </div>
      <input type="checkbox" className="hidden" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-sm text-gray-700 flex items-center gap-1.5">
         {Icon && <Icon className="w-4 h-4 text-gray-600" />} {label}
      </span>
    </label>
  );

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Live Scraper</h1>
        <p className="text-gray-600">Extract high-quality leads from Google Maps instantly.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        <div className="xl:col-span-4 space-y-6">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 relative overflow-hidden group">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-400" /> Search Parameters
            </h2>
            <form onSubmit={handleScrape} className="space-y-5 relative z-10">
              <div className="space-y-2">
                <label className="text-sm text-gray-600 font-medium">Business Category</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <select 
                    value={category} onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-gray-100 border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-gray-900 appearance-none focus:outline-none focus:border-blue-500/50"
                  >
                    {COMMON_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-600 font-medium">Location</label>
                <div className="relative z-50">
                  <CreatableSelect 
                    instanceId="location-select" isClearable options={locationOptions}
                    value={location ? { label: location, value: location } : null}
                    onChange={(newValue) => setLocation(newValue ? newValue.value : "")}
                    className="text-black" placeholder="Type or select a city/state..."
                    styles={{
                      control: (base) => ({ ...base, backgroundColor: '#1a1a1a', borderColor: '#1f2937', color: 'white', padding: '4px', borderRadius: '0.75rem' }),
                      singleValue: (base) => ({ ...base, color: 'white' }),
                      input: (base) => ({ ...base, color: 'white' }),
                      menu: (base) => ({ ...base, backgroundColor: '#1a1a1a', zIndex: 100 }),
                      option: (base, state) => ({ ...base, backgroundColor: state.isFocused ? '#2563eb' : '#1a1a1a', color: 'white' })
                    }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                   <label className="text-sm text-gray-600 font-medium">Max Leads</label>
                   <span className="text-sm text-blue-400 font-bold">{maxLeads}</span>
                </div>
                <input type="range" min="10" max="200" step="10" value={maxLeads} onChange={(e) => setMaxLeads(parseInt(e.target.value))} className="w-full accent-blue-500" />
              </div>
              <div className="pt-2 space-y-3 bg-[#0a0a0a] p-4 rounded-xl border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Required Socials / Web</h3>
                <FilterCheckbox label="Website" icon={Globe} checked={mustHaveWebsite} onChange={setMustHaveWebsite} />
                <FilterCheckbox label="Instagram" icon={InstagramIcon} checked={mustHaveInstagram} onChange={setMustHaveInstagram} />
                <FilterCheckbox label="Facebook" icon={FacebookIcon} checked={mustHaveFacebook} onChange={setMustHaveFacebook} />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-gray-900 hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-500 rounded-xl py-3.5 font-semibold transition-all flex items-center justify-center gap-2 mt-4">
                {loading ? <><Loader2 className="w-5 h-5 animate-spin" /> Extracting Leads...</> : "Start Scraping"}
              </button>
            </form>
          </div>
        </div>

        <div className="xl:col-span-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl flex items-start gap-3 mb-6">
              <XCircle className="w-5 h-5 mt-0.5 shrink-0" />
              <p className="text-sm">{error}</p>
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col h-[700px]">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-100">
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                {loading ? <><Loader2 className="w-4 h-4 animate-spin text-blue-500" /> {statusMessage}</> : <><CheckCircle2 className="w-4 h-4 text-green-500" /> {statusMessage || "Ready"}</>}
              </h3>
              <div className="flex gap-3 items-center">
                {selectedLeads.size > 0 && (
                  <div className="flex items-center gap-2 mr-2 bg-blue-500/10 px-3 py-1.5 rounded-xl border border-blue-500/20">
                    <Users className="w-4 h-4 text-blue-400" />
                    <select 
                      value={assigningTo} 
                      onChange={e => setAssigningTo(e.target.value)}
                      className="bg-transparent text-sm text-gray-900 focus:outline-none w-32"
                    >
                      <option value="" className="text-black">Assign to...</option>
                      {agents.map(a => <option key={a.id} value={a.id} className="text-black">{a.name}</option>)}
                    </select>
                    <button 
                      onClick={handleAssign}
                      disabled={!assigningTo || isAssigning}
                      className="bg-blue-600 hover:bg-blue-500 text-gray-900 px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-50"
                    >
                      {isAssigning ? "..." : "Assign"}
                    </button>
                  </div>
                )}
                <button onClick={() => handleDownloadCSV(leads, "Live Scrape")} disabled={leads.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-white text-black rounded-lg text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors">
                  <Download className="w-4 h-4" /> CSV
                </button>
                <button onClick={() => handleDownloadPDF(leads, "Live Scrape")} disabled={leads.length === 0} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-gray-900 rounded-lg text-sm font-medium hover:bg-blue-500 disabled:opacity-50 transition-colors">
                  <FileText className="w-4 h-4" /> PDF
                </button>
              </div>
            </div>

            <div className="overflow-auto flex-1 w-full bg-[#0a0a0a]">
              {leads.length === 0 ? (
                <div className="p-6">
                  <h4 className="text-gray-600 font-semibold mb-4 text-sm flex items-center gap-2">
                     <FileText className="w-4 h-4 text-blue-400" /> Previous Scrapes Run History
                  </h4>
                  {loadingHistory ? (
                     <div className="flex justify-center items-center py-20 text-gray-500 gap-2">
                       <Loader2 className="w-5 h-5 animate-spin" /> Loading run history...
                     </div>
                  ) : scraperRuns.length === 0 ? (
                     <div className="flex flex-col justify-center items-center py-20 text-gray-600 gap-2">
                       <Search className="w-10 h-10 opacity-30" />
                       <p className="text-sm">No scraper runs recorded. Use the parameters on the left to start scraping!</p>
                     </div>
                  ) : (
                    <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                      <thead className="bg-white text-gray-600 sticky top-0 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3.5 font-semibold">Date & Time</th>
                          <th className="px-6 py-3.5 font-semibold">Category Niche</th>
                          <th className="px-6 py-3.5 font-semibold">Location</th>
                          <th className="px-6 py-3.5 font-semibold text-center">Max Requested</th>
                          <th className="px-6 py-3.5 font-semibold text-center">New Leads Found</th>
                          <th className="px-6 py-3.5 font-semibold text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-800/50">
                        {scraperRuns.map((run) => (
                          <tr key={run.id} className="hover:bg-gray-100 transition-colors">
                            <td className="px-6 py-3.5 font-mono text-xs text-gray-600">
                              {new Date(run.created_at).toLocaleString()}
                            </td>
                            <td className="px-6 py-3.5 font-semibold text-gray-800">
                              {run.category}
                            </td>
                            <td className="px-6 py-3.5 text-gray-700">
                              <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-gray-500" /> {run.location}</span>
                            </td>
                            <td className="px-6 py-3.5 text-center font-semibold text-gray-600">
                              {run.max_leads}
                            </td>
                            <td className="px-6 py-3.5 text-center font-bold text-emerald-400">
                              {run.leads_found || 0}
                            </td>
                            <td className="px-6 py-3.5 text-right">
                              <span className={`px-2 py-0.5 rounded text-xs font-bold border ${run.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : run.status === 'Running' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                {run.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ) : (
                <table className="w-full text-left text-sm border-collapse min-w-[800px]">
                  <thead className="bg-white text-gray-600 sticky top-0 z-10 shadow-sm border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-4 w-12">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-gray-600 bg-gray-100 accent-blue-500 cursor-pointer"
                          checked={selectedLeads.size > 0 && selectedLeads.size === leads.filter(l => l.id).length}
                          onChange={toggleAll}
                          disabled={leads.filter(l => l.id).length === 0}
                        />
                      </th>
                      <th className="px-6 py-4 font-semibold w-1/4">Business Name</th>
                      <th className="px-6 py-4 font-semibold">Tags</th>
                      <th className="px-6 py-4 font-semibold">Phone Number</th>
                      <th className="px-6 py-4 font-semibold">Website</th>
                      <th className="px-6 py-4 font-semibold">Socials</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {leads.map((lead: any, idx) => (
                      <tr key={idx} className="hover:bg-gray-100 transition-colors group">
                        <td className="px-6 py-4">
                          {lead.id && (
                            <input 
                              type="checkbox" 
                              className="w-4 h-4 rounded border-gray-600 bg-gray-100 accent-blue-500 cursor-pointer"
                              checked={selectedLeads.has(lead.id)}
                              onChange={() => toggleSelection(lead.id)}
                            />
                          )}
                        </td>
                        <td className="px-6 py-4">
                           {lead.gmbUrl ? (
                             <a href={lead.gmbUrl} target="_blank" rel="noreferrer" className="text-gray-100 font-semibold text-base mb-1 hover:text-blue-400 transition-colors whitespace-normal break-words underline decoration-blue-500/30 underline-offset-4 block">{lead.name}</a>
                           ) : <div className="text-gray-100 font-semibold text-base mb-1 group-hover:text-blue-400 transition-colors whitespace-normal break-words">{lead.name}</div>}
                        </td>
                        <td className="px-6 py-4">
                           <div className="flex flex-col gap-2 items-start">
                             {lead.category && <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-1 rounded-md text-xs font-medium">{lead.category}</span>}
                             {lead.location && <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1"><MapPin className="w-3 h-3" /> {lead.location}</span>}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                           <div className="font-mono text-blue-400 bg-blue-500/10 inline-block px-3 py-1.5 rounded-lg border border-blue-500/20 font-medium tracking-wide">
                              {lead.phone ? `'${lead.phone}` : "No Phone"}
                           </div>
                        </td>
                        <td className="px-6 py-4">
                          {lead.website ? <a href={lead.website} target="_blank" rel="noreferrer" className="text-gray-700 hover:text-gray-900 flex items-center gap-1.5 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg w-fit transition-colors border border-white/5"><Globe className="w-3.5 h-3.5 text-blue-400" /> {new URL(lead.website).hostname.replace('www.', '')}</a> : <span className="text-gray-700 px-3 py-1.5">N/A</span>}
                        </td>
                        <td className="px-6 py-4 flex gap-2 items-center flex-wrap pt-5">
                            {lead.instagram ? <a href={lead.instagram} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-pink-400 hover:text-pink-300 bg-pink-500/10 px-3 py-1.5 rounded-lg hover:bg-pink-500/20 transition-colors font-medium border border-pink-500/10"><InstagramIcon className="w-4 h-4" /> Insta</a> : <div className="flex items-center gap-1.5 px-3 py-1.5 text-gray-700 font-medium"><InstagramIcon className="w-4 h-4" /> Insta</div>}
                            {lead.facebook ? <a href={lead.facebook} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-blue-500 hover:text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-lg hover:bg-blue-500/20 transition-colors font-medium border border-blue-500/10"><FacebookIcon className="w-4 h-4" /> FB</a> : <div className="flex items-center gap-1.5 px-3 py-1.5 text-gray-700 font-medium"><FacebookIcon className="w-4 h-4" /> FB</div>}
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
    </div>
  );
}
