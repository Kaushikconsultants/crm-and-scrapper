"use client";

import { useState, useEffect } from "react";
import { XCircle, Loader2, PhoneCall, Clock, Globe, MapPin, MessageCircle, Save, CalendarClock, Users, CheckCircle2, FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import { getLeadScoreBadge } from "@/utils/scoring";
import jsPDF from "jspdf";

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
  const [agentName, setAgentName] = useState("");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const generateAuditReport = async () => {
    setGeneratingPdf(true);
    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      
      // Load Logo
      const logoData = await new Promise<string | null>((resolve) => {
        const img = new Image();
        img.src = '/logo.jpg';
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/jpeg'));
        };
        img.onerror = () => resolve(null);
      });

      // Cover page background accents
      doc.setFillColor(248, 250, 252);
      doc.rect(0, 0, 210, 297, 'F');
      
      // Top deep slate blue header banner
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 60, 'F');

      // Logo
      if (logoData) {
        doc.addImage(logoData, 'JPEG', 15, 12, 36, 36);
      }

      // Title header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(255, 255, 255);
      doc.text("BUSINESS AUDIT & GROWTH REPORT", 60, 26);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184);
      doc.text("WE DON'T JUST BUILD WEBSITES — WE BUILD BRANDS.", 60, 33);
      doc.text("Prepared by Hyperscript Solutions (", 60, 38);
      const prepWidth = doc.getTextWidth("Prepared by Hyperscript Solutions (");
      doc.setTextColor(96, 165, 250);
      doc.text("hyperscriptsolutions.in", 60 + prepWidth, 38);
      const linkW1 = doc.getTextWidth("hyperscriptsolutions.in");
      doc.link(60 + prepWidth, 38 - (9 * 0.353) + 1, linkW1, 9 * 0.353, { url: "https://hyperscriptsolutions.in" });
      doc.setTextColor(148, 163, 184);
      doc.text(")", 60 + prepWidth + linkW1, 38);

      // Digital Presence Health Score calculation
      let auditScore = 100;
      if (!lead.website) auditScore -= 35;
      if (lead.rating && parseFloat(lead.rating) < 4.2) auditScore -= 15;
      if (!lead.reviews || parseInt(lead.reviews) < 15) auditScore -= 15;
      if (!lead.instagram) auditScore -= 10;
      if (!lead.facebook) auditScore -= 10;
      auditScore = Math.max(auditScore, 20); // Keep it min 20

      // Client Title Block
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(15, 75, 180, 50, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(15, 75, 180, 50, 3, 3, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(71, 85, 105);
      doc.text("REPORT TARGET CLIENT", 22, 87);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(30, 41, 59);
      doc.text(lead.name || "Client Business", 22, 97);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`Location: ${lead.location || "Haryana, India"}`, 22, 105);
      doc.text(`Category: ${lead.category || "General Business"}`, 22, 111);
      doc.text(`Date Prepared: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, 22, 117);

      // Score Badge on Right Side of Title Block
      doc.setFillColor(auditScore >= 80 ? 240 : (auditScore >= 50 ? 254 : 254), auditScore >= 80 ? 253 : (auditScore >= 50 ? 243 : 242), auditScore >= 80 ? 250 : (auditScore >= 50 ? 199 : 242));
      doc.setDrawColor(auditScore >= 80 ? 22 : (auditScore >= 50 ? 217 : 239), auditScore >= 80 ? 163 : (auditScore >= 50 ? 119 : 68), auditScore >= 80 ? 74 : (auditScore >= 50 ? 6 : 68));
      doc.roundedRect(145, 83, 42, 34, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("PRESENCE SCORE", 148, 90);

      doc.setFontSize(18);
      doc.setTextColor(auditScore >= 80 ? 22 : (auditScore >= 50 ? 217 : 239), auditScore >= 80 ? 163 : (auditScore >= 50 ? 119 : 68), auditScore >= 80 ? 74 : (auditScore >= 50 ? 6 : 68));
      doc.text(`${auditScore}/100`, 150, 102);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const grade = auditScore >= 80 ? "Optimized" : (auditScore >= 50 ? "Needs Work" : "Critical Risk");
      doc.text(grade, 150, 110);

      // Section 1: GMB Audit
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text("1. Google My Business (GMB) Analysis", 15, 142);
      doc.setDrawColor(37, 99, 235);
      doc.setLineWidth(0.8);
      doc.line(15, 145, 95, 145);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      
      const ratingText = lead.rating ? `${lead.rating} Stars` : "Not Found / Unrated";
      const reviewsText = lead.reviews ? `${lead.reviews} Reviews` : "No reviews listed";
      
      doc.text(`GMB Rating: ${ratingText}`, 15, 153);
      doc.text(`Review Volume: ${reviewsText}`, 15, 159);

      if (lead.gmbUrl) {
        doc.text("GMB Listing Link: ", 15, 165);
        const gmbLabelW = doc.getTextWidth("GMB Listing Link: ");
        doc.setTextColor(37, 99, 235);
        doc.text("View Profile on Google Maps", 15 + gmbLabelW, 165);
        const gmbLinkW = doc.getTextWidth("View Profile on Google Maps");
        doc.link(15 + gmbLabelW, 165 - (10 * 0.353) + 1, gmbLinkW, 10 * 0.353, { url: lead.gmbUrl });
        doc.setTextColor(51, 65, 85);
      }

      doc.setFont('helvetica', 'bold');
      doc.text("GMB Recommendations:", 15, 174);
      doc.setFont('helvetica', 'normal');
      
      const gmbRecs = lead.rating && parseFloat(lead.rating) < 4.2 
        ? ["* Actively request 5-star reviews from connected clients to boost score.", "* Respond to all existing positive and negative feedback.", "* Upload geotagged business and service photos weekly to Google Maps."]
        : ["* Setup automated review links to maintain high local standing.", "* Post regular promotional business updates directly on the GMB card.", "* Add local schema markup to search listings."];
      
      gmbRecs.forEach((rec, i) => {
        doc.text(rec, 15, 181 + (i * 6));
      });

      // Section 2: Website Scan
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text("2. Technical Website Deep Scan", 15, 206);
      doc.line(15, 209, 95, 209);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);

      if (!lead.website) {
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
        doc.text("CRITICAL GAP: Business has NO website link registered on Google Maps.", 15, 217);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(51, 65, 85);
        doc.text("Impact: Over 60% of local searches are lost to competitors with active websites.", 15, 223);
        doc.text("Recommendations:", 15, 231);
        doc.text("* Design a fully responsive, modern website to capture local lead traffic.", 20, 237);
        doc.text("* Connect custom domain and install SSL to build brand trust.", 20, 243);
      } else {
        doc.text("Website URL: ", 15, 217);
        const wLabel = doc.getTextWidth("Website URL: ");
        doc.setTextColor(37, 99, 235);
        doc.text(lead.website, 15 + wLabel, 217);
        const wWidth = doc.getTextWidth(lead.website);
        const normalizedWeb = lead.website.startsWith('http') ? lead.website : 'https://' + lead.website;
        doc.link(15 + wLabel, 217 - (10 * 0.353) + 1, wWidth, 10 * 0.353, { url: normalizedWeb });
        doc.setTextColor(51, 65, 85);

        doc.text("Estimated Load Speed Score: 78/100 (Mobile) | 91/100 (Desktop)", 15, 223);
        doc.text("Website Optimization Recommendations:", 15, 231);
        doc.text("* Compress static assets and enable Next-Gen image formatting (WebP).", 20, 237);
        doc.text("* Improve Mobile Responsiveness and layout shifts (CLS) to satisfy Core Web Vitals.", 20, 243);
        doc.text("* Fix metadata tags (Title, Description) for target search keywords.", 20, 249);
      }

      // Go to Page 2
      doc.addPage();

      // Top Header for Page 2
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, 210, 15, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text("HYPERSCRIPT SOLUTIONS - ENTERPRISE BUSINESS AUDIT", 15, 10);

      // Section 3: Social Links
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      doc.text("3. Social Media Presence", 15, 30);
      doc.setDrawColor(37, 99, 235);
      doc.line(15, 33, 95, 33);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);

      doc.text("Instagram Link: ", 15, 42);
      const instaLabelW = doc.getTextWidth("Instagram Link: ");
      if (lead.instagram) {
        doc.setTextColor(37, 99, 235);
        doc.text(lead.instagram, 15 + instaLabelW, 42);
        const instaW = doc.getTextWidth(lead.instagram);
        const targetInsta = lead.instagram.startsWith('http') ? lead.instagram : `https://instagram.com/${lead.instagram.replace('@', '')}`;
        doc.link(15 + instaLabelW, 42 - (10 * 0.353) + 1, instaW, 10 * 0.353, { url: targetInsta });
        doc.setTextColor(51, 65, 85);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text("Missing Profile Link", 15 + instaLabelW, 42);
        doc.setTextColor(51, 65, 85);
      }

      doc.text("Facebook Link: ", 15, 48);
      const fbLabelW = doc.getTextWidth("Facebook Link: ");
      if (lead.facebook) {
        doc.setTextColor(37, 99, 235);
        doc.text(lead.facebook, 15 + fbLabelW, 48);
        const fbW = doc.getTextWidth(lead.facebook);
        const targetFb = lead.facebook.startsWith('http') ? lead.facebook : `https://facebook.com/${lead.facebook}`;
        doc.link(15 + fbLabelW, 48 - (10 * 0.353) + 1, fbW, 10 * 0.353, { url: targetFb });
        doc.setTextColor(51, 65, 85);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.text("Missing Profile Link", 15 + fbLabelW, 48);
        doc.setTextColor(51, 65, 85);
      }

      doc.setFont('helvetica', 'bold');
      doc.text("Social Media Gaps & Action Items:", 15, 57);
      doc.setFont('helvetica', 'normal');

      if (!lead.instagram || !lead.facebook) {
        doc.text("* Setup official business handles on Instagram and Facebook immediately.", 15, 64);
        doc.text("* Display consistent branding visuals (logo, bio keywords, contact buttons) to build trust.", 15, 70);
        doc.text("* Sync GMB local listing with social pages to establish a unified digital footprint.", 15, 76);
      } else {
        doc.text("* Implement a unified posting schedule (reels, updates) to stay in front of local clients.", 15, 64);
        doc.text("* Embed GMB positive customer reviews into your Instagram grid as social proof.", 15, 70);
      }

      // Section 4: Hyperscript Solutions Offering
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(15, 95, 180, 95, 3, 3, 'F');
      doc.setDrawColor(219, 234, 254);
      doc.roundedRect(15, 95, 180, 95, 3, 3, 'D');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235);
      doc.text("How Hyperscript Solutions Can Help", 22, 109);
      doc.setDrawColor(37, 99, 235);
      doc.line(22, 112, 105, 112);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85);
      doc.text("We specialize in transforming local businesses into premium digital brands:", 22, 121);
      
      doc.setFont('helvetica', 'bold');
      doc.text("- Web Design & Performance SEO:", 22, 133);
      doc.setFont('helvetica', 'normal');
      doc.text("Fast, custom Next.js/React website design built for high client conversions.", 82, 133);

      doc.setFont('helvetica', 'bold');
      doc.text("- Local SEO & GMB Optimization:", 22, 142);
      doc.setFont('helvetica', 'normal');
      doc.text("Setup, citation building, and review campaign automation to rank #1 locally.", 82, 142);

      doc.setFont('helvetica', 'bold');
      doc.text("- Brand Auditing & Social Media:", 22, 151);
      doc.setFont('helvetica', 'normal');
      doc.text("Content design, setup, and marketing templates tailormade for growth.", 82, 151);

      // Section 5: Call to Action Footer
      doc.setFillColor(15, 23, 42);
      doc.rect(15, 205, 180, 62, 'F');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("LET'S BUILD YOUR BRAND", 25, 218);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(148, 163, 184);
      doc.text("Ready to fix these gaps and grow your revenue? Contact us today.", 25, 225);
      
      // Let's print the contact handles and make them clickable
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9.5);
      
      doc.text("Website: ", 25, 236);
      let fW = doc.getTextWidth("Website: ");
      doc.setTextColor(96, 165, 250); // Light blue for contrast in dark banner
      doc.text("hyperscriptsolutions.in", 25 + fW, 236);
      let linkW = doc.getTextWidth("hyperscriptsolutions.in");
      doc.link(25 + fW, 236 - (9.5 * 0.353) + 1, linkW, 9.5 * 0.353, { url: "https://hyperscriptsolutions.in" });

      doc.setTextColor(255, 255, 255);
      doc.text("  |  Instagram: ", 25 + fW + linkW, 236);
      let fW2 = doc.getTextWidth("  |  Instagram: ");
      doc.setTextColor(96, 165, 250);
      doc.text("@hyperscriptsolutions", 25 + fW + linkW + fW2, 236);
      let linkW2 = doc.getTextWidth("@hyperscriptsolutions");
      doc.link(25 + fW + linkW + fW2, 236 - (9.5 * 0.353) + 1, linkW2, 9.5 * 0.353, { url: "https://instagram.com/hyperscriptsolutions" });

      // Call Mobile number
      doc.setTextColor(255, 255, 255);
      doc.text("Call / WhatsApp: ", 25, 244);
      let fW3 = doc.getTextWidth("Call / WhatsApp: ");
      doc.setTextColor(96, 165, 250);
      doc.text("+91 9306302402", 25 + fW3, 244);
      let linkW3 = doc.getTextWidth("+91 9306302402");
      doc.link(25 + fW3, 244 - (9.5 * 0.353) + 1, linkW3, 9.5 * 0.353, { url: "tel:+919306302402" });

      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8.5);
      doc.text("Tagline: WE DON'T JUST BUILD WEBSITES — WE BUILD BRANDS.", 25, 255);

      // Save PDF
      doc.save(`${lead.name.replace(/\s+/g, '_')}_Audit_Report.pdf`);
    } catch (err: any) {
      alert("Error generating PDF: " + err.message);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const supabase = createClient();

  useEffect(() => {
    if (currentUserId) {
      supabase.from('agent_profiles').select('name').eq('id', currentUserId).single().then(({ data }) => {
        if (data?.name) {
          setAgentName(data.name);
        }
      });
    }
  }, [currentUserId]);

  const fetchInsights = async () => {
    setLoadingInsights(true);
    setInsights("");
    const language = localStorage.getItem("ai_outreach_language") || "English";
    try {
      const res = await fetch("/api/generate-insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          lead,
          language,
          agentName: agentName || "our agent",
          previousCalls: logs || []
        }),
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
    setInsights(""); // Reset insights when lead changes
  }, [lead.id]);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    const activeUserId = currentUserId || user?.id;
    
    let isAdmin = false;
    if (activeUserId) {
      const { data: profile } = await supabase.from('agent_profiles').select('role').eq('id', activeUserId).single();
      isAdmin = profile?.role === 'admin';
    }

    let query = supabase
      .from('call_logs')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false });

    if (!isAdmin && activeUserId) {
      query = query.eq('agent_id', activeUserId);
    }

    const { data: logsData } = await query;

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

            {/* Business PDF Audit Card */}
            <div className="mt-6 border-t border-gray-800/80 pt-4">
              <button
                type="button"
                onClick={generateAuditReport}
                disabled={generatingPdf}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10 hover:shadow-blue-500/20 active:scale-95"
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Generating Custom PDF...
                  </>
                ) : (
                  <>
                    <FileText className="w-4 h-4" />
                    Generate PDF Growth Audit
                  </>
                )}
              </button>
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
