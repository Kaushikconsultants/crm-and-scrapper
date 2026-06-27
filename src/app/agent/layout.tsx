"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneCall, CalendarClock, LogOut, KanbanSquare, ChevronLeft, ChevronRight, X, Bell, MessageCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { getWhatsAppUrl } from "@/utils/whatsapp";
import CustomerProfileModal from "@/app/components/CustomerProfileModal";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [toasts, setToasts] = useState<any[]>([]);
  const [selectedProfileLead, setSelectedProfileLead] = useState<any>(null);
  const notifiedLeads = useRef<Set<string>>(new Set());

  const openLeadProfile = async (leadId: string) => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (data) {
      setSelectedProfileLead(data);
    } else {
      alert("Failed to open lead profile: " + (error?.message || "Lead not found"));
    }
  };

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 1200) {
        setIsCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Request browser Notification permissions
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "default") {
        Notification.requestPermission();
      }
    }
  }, []);

  // Periodically check for follow-ups due in the next 5 minutes
  useEffect(() => {
    const fetchUserAndCheck = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        checkUpcomingFollowUps(user.id);
      }
    };
    fetchUserAndCheck();

    const interval = setInterval(() => {
      if (currentUser?.id) {
        checkUpcomingFollowUps(currentUser.id);
      } else {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            setCurrentUser(user);
            checkUpcomingFollowUps(user.id);
          }
        });
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [currentUser?.id]);

  const checkUpcomingFollowUps = async (userId: string) => {
    try {
      const now = new Date();
      // Target time window is 5 minutes from now (plus a 30s buffer)
      const targetTimeMin = new Date(now.getTime() + 4.5 * 60 * 1000);
      const targetTimeMax = new Date(now.getTime() + 5.5 * 60 * 1000);

      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, follow_up_date")
        .eq("assigned_to", userId)
        .not("follow_up_date", "is", null)
        .gte("follow_up_date", targetTimeMin.toISOString())
        .lte("follow_up_date", targetTimeMax.toISOString());

      if (data && data.length > 0) {
        data.forEach((lead) => {
          if (!notifiedLeads.current.has(lead.id)) {
            notifiedLeads.current.add(lead.id);
            triggerNotification(lead);
          }
        });
      }
    } catch (err) {
      console.error("Error checking upcoming followups:", err);
    }
  };

  const triggerNotification = (lead: any) => {
    // 1. Add Custom Toast Notification
    setToasts((prev) => [
      ...prev,
      {
        id: lead.id,
        name: lead.name,
        phone: lead.phone,
        message: `Follow-up scheduled in 5 minutes!`,
      },
    ]);

    // 2. HTML5 Web Notification
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "granted") {
      new Notification(`Upcoming Follow-up: ${lead.name}`, {
        body: `Your scheduled follow-up is in 5 minutes.`,
        icon: "/favicon.ico",
      });
    }
  };

  const closeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navLinks = [
    { href: "/agent/dashboard", label: "My Assigned Leads", icon: <PhoneCall className="w-4 h-4" /> },
    { href: "/agent/follow-ups", label: "My Follow-ups", icon: <CalendarClock className="w-4 h-4" /> },
    { href: "/agent/pipeline", label: "Pipeline Kanban", icon: <KanbanSquare className="w-4 h-4" /> },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? "w-16" : "w-52"} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 relative shrink-0`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent truncate">
              Agent Portal
            </h1>
          )}
          <button 
            onClick={() => setIsCollapsed(!isCollapsed)} 
            className="p-1.5 rounded-lg bg-gray-200 hover:bg-gray-700 text-gray-600 hover:text-gray-900 transition-colors mx-auto"
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
        
        <nav className="flex-1 p-2 space-y-1">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-colors ${
                  isActive ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20" : "text-gray-600 hover:bg-white/5 hover:text-gray-900"
                }`}
                title={isCollapsed ? link.label : undefined}
              >
                <span className="shrink-0">{link.icon}</span>
                {!isCollapsed && <span className="font-medium text-sm truncate">{link.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-2 border-t border-gray-200">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
            title={isCollapsed ? "Sign Out" : undefined}
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span className="font-medium text-sm truncate">Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>

      {/* Toast Reminders Container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div 
            key={toast.id} 
            className="pointer-events-auto bg-white border border-orange-500/30 rounded-xl p-3 shadow-2xl flex gap-3 backdrop-blur-md transition-all duration-300 animate-in fade-in slide-in-from-bottom-5"
          >
            <div className="w-8 h-8 rounded-full bg-orange-500/10 text-orange-400 flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900">Upcoming Follow-up</p>
              <p className="text-xs font-semibold text-orange-400 truncate mt-0.5">{toast.name}</p>
              <p className="text-[10px] text-gray-600 mt-1">{toast.message}</p>
              <div className="flex gap-2 mt-2 flex-wrap">
                {toast.phone && (
                  <a 
                    href={getWhatsAppUrl(toast.phone, toast.name)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2 py-1 rounded inline-flex items-center gap-1 transition-colors"
                  >
                    <MessageCircle className="w-3 h-3" /> Message
                  </a>
                )}
                <button 
                  onClick={() => { openLeadProfile(toast.id); closeToast(toast.id); }}
                  className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-1 rounded inline-flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Log Call / Profile
                </button>
              </div>
            </div>
            <button 
              onClick={() => closeToast(toast.id)} 
              className="text-gray-500 hover:text-gray-900 shrink-0 self-start p-0.5 rounded hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Global Customer Profile Modal from Toast */}
      {selectedProfileLead && (
        <CustomerProfileModal
          lead={selectedProfileLead}
          onClose={() => setSelectedProfileLead(null)}
          currentUserId={currentUser?.id}
          onLeadUpdate={(updatedLead) => {
            window.dispatchEvent(new CustomEvent("leadUpdated", { detail: updatedLead }));
          }}
        />
      )}
    </div>
  );
}
