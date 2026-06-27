"use client";

import { useState, useEffect } from "react";
import { FileText, Save, Download, Plus, Trash2, Loader2, FolderOpen, X } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { generateProposalPdf, ProposalData, LineItem } from "@/utils/proposalPdf";

const DEFAULT_LINE_ITEM: LineItem = {
  id: '',
  offer: 'Web Development & Design',
  roles: 'Frontend & Backend development, UI/UX design',
  qty: 1,
  duration: '1 Month',
  price: 25000
};

export default function ProposalsPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  
  // Form State
  const [title, setTitle] = useState("BUSINESS PROPOSAL & QUOTATION");
  const [clientName, setClientName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [location, setLocation] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { ...DEFAULT_LINE_ITEM, id: crypto.randomUUID() }
  ]);
  const [taxRate, setTaxRate] = useState(18); // 18% GST by default

  // Templates Modal State
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  // Derived calculations
  const subtotal = lineItems.reduce((acc, item) => acc + (item.qty * item.price), 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal + taxAmount;

  const handleAddLineItem = () => {
    setLineItems([...lineItems, { ...DEFAULT_LINE_ITEM, id: crypto.randomUUID() }]);
  };

  const handleRemoveLineItem = (id: string) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter(item => item.id !== id));
    }
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: any) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const generatePdf = async () => {
    if (!businessName || !clientName) {
      alert("Please fill in the client and business names.");
      return;
    }
    
    const data: ProposalData = {
      title,
      clientName,
      businessName,
      location,
      phone,
      email,
      lineItems,
      subtotal,
      tax: taxAmount,
      total: grandTotal
    };

    await generateProposalPdf(data);
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    const { data, error } = await supabase
      .from('proposals')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      alert("Error fetching templates: " + error.message);
    } else {
      setTemplates(data || []);
    }
    setLoadingTemplates(false);
  };

  const openTemplates = () => {
    fetchTemplates();
    setShowTemplates(true);
  };

  const saveAsTemplate = async () => {
    if (!title || !businessName) {
      alert("Please provide a Title and Business Name to save the template.");
      return;
    }

    setSaving(true);
    const client_details = { clientName, businessName, location, phone, email, title, taxRate };
    
    const { error } = await supabase
      .from('proposals')
      .insert({
        title: `${businessName} - ${title}`,
        client_details,
        line_items: lineItems
      });

    setSaving(false);

    if (error) {
      alert("Error saving template: " + error.message);
    } else {
      alert("Template saved successfully!");
    }
  };

  const loadTemplate = (template: any) => {
    const details = template.client_details;
    setTitle(details.title || "BUSINESS PROPOSAL & QUOTATION");
    setClientName(details.clientName || "");
    setBusinessName(details.businessName || "");
    setLocation(details.location || "");
    setPhone(details.phone || "");
    setEmail(details.email || "");
    setTaxRate(details.taxRate ?? 18);
    setLineItems(template.line_items || []);
    setShowTemplates(false);
  };

  return (
    <div className="p-4 max-w-[1200px] mx-auto min-h-screen bg-gray-50 flex flex-col space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-600" /> Proposal & Quotation Generator
          </h1>
          <p className="text-gray-600 text-sm mt-1">Create branded PDFs and save reusable templates.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={openTemplates}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-semibold transition-colors"
          >
            <FolderOpen className="w-4 h-4" /> Load Template
          </button>
          <button 
            onClick={saveAsTemplate}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-sm font-semibold transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
          <button 
            onClick={generatePdf}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" /> Generate PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Client Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Document Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Document Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500" 
                />
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-4 border-b border-gray-100 pb-2">Client Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Business Name *</label>
                <input 
                  type="text" 
                  value={businessName} 
                  onChange={e => setBusinessName(e.target.value)} 
                  placeholder="e.g. Acme Corp"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Contact Name *</label>
                <input 
                  type="text" 
                  value={clientName} 
                  onChange={e => setClientName(e.target.value)} 
                  placeholder="e.g. John Doe"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500" 
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                <input 
                  type="text" 
                  value={location} 
                  onChange={e => setLocation(e.target.value)} 
                  placeholder="e.g. Delhi, India"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label>
                  <input 
                    type="text" 
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500" 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Line Items & Summary */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-semibold text-gray-900">Line Items & Offers</h3>
              <button 
                onClick={handleAddLineItem}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 hover:bg-blue-200 rounded-lg text-xs font-bold transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Item
              </button>
            </div>
            
            <div className="p-5 space-y-6">
              {lineItems.map((item, index) => (
                <div key={item.id} className="relative p-4 rounded-xl border border-gray-200 bg-gray-50/50 group">
                  {lineItems.length > 1 && (
                    <button 
                      onClick={() => handleRemoveLineItem(item.id)}
                      className="absolute -top-3 -right-3 w-7 h-7 bg-white border border-gray-200 rounded-full flex items-center justify-center text-red-500 hover:bg-red-50 hover:border-red-200 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-6 h-6 rounded bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">{index + 1}</div>
                    <input 
                      type="text" 
                      value={item.offer}
                      onChange={(e) => updateLineItem(item.id, 'offer', e.target.value)}
                      placeholder="Service Name / Offer"
                      className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-12">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Details / Roles</label>
                      <textarea 
                        value={item.roles}
                        onChange={(e) => updateLineItem(item.id, 'roles', e.target.value)}
                        placeholder="Detailed description, roles, features..."
                        rows={2}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 resize-none"
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Duration</label>
                      <input 
                        type="text" 
                        value={item.duration}
                        onChange={(e) => updateLineItem(item.id, 'duration', e.target.value)}
                        placeholder="e.g. 1 Month"
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-3">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Qty</label>
                      <input 
                        type="number" 
                        value={item.qty}
                        onChange={(e) => updateLineItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                        min={1}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="md:col-span-5">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Unit Price (₹)</label>
                      <input 
                        type="number" 
                        value={item.price}
                        onChange={(e) => updateLineItem(item.id, 'price', parseInt(e.target.value) || 0)}
                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-blue-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <div className="flex flex-col items-end gap-3 w-full max-w-sm ml-auto">
              <div className="flex justify-between w-full text-sm text-gray-600">
                <span>Subtotal</span>
                <span className="font-mono font-medium">₹{subtotal.toLocaleString()}</span>
              </div>
              <div className="flex justify-between w-full text-sm text-gray-600 items-center">
                <span className="flex items-center gap-2">
                  Tax Rate (%)
                  <input 
                    type="number" 
                    value={taxRate} 
                    onChange={e => setTaxRate(parseFloat(e.target.value) || 0)}
                    className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-xs outline-none"
                  />
                </span>
                <span className="font-mono font-medium">₹{taxAmount.toLocaleString()}</span>
              </div>
              <div className="w-full h-px bg-gray-200 my-2"></div>
              <div className="flex justify-between w-full text-lg font-bold text-gray-900">
                <span>Grand Total</span>
                <span className="font-mono text-blue-600">₹{grandTotal.toLocaleString()}</span>
              </div>
            </div>
          </div>
          
        </div>
      </div>

      {/* Templates Modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[80vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="font-bold text-gray-900 flex items-center gap-2">
                <FolderOpen className="w-5 h-5 text-blue-600" /> Saved Templates
              </h2>
              <button onClick={() => setShowTemplates(false)} className="text-gray-400 hover:text-gray-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-auto flex-1">
              {loadingTemplates ? (
                <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
              ) : templates.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm">No saved templates found.</div>
              ) : (
                <div className="space-y-3">
                  {templates.map(template => (
                    <div key={template.id} className="flex justify-between items-center p-4 rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all bg-white cursor-pointer group" onClick={() => loadTemplate(template)}>
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 group-hover:text-blue-700">{template.title}</h4>
                        <p className="text-xs text-gray-500 mt-1">Saved: {new Date(template.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        Load Template
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
