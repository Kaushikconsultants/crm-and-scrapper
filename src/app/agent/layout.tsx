"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PhoneCall, CalendarClock, LogOut, KanbanSquare } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AgentLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navLinks = [
    { href: "/agent/dashboard", label: "My Assigned Leads", icon: <PhoneCall className="w-5 h-5" /> },
    { href: "/agent/follow-ups", label: "My Follow-ups", icon: <CalendarClock className="w-5 h-5" /> },
    { href: "/agent/pipeline", label: "Pipeline Kanban", icon: <KanbanSquare className="w-5 h-5" /> },
  ];

  return (
    <div className="flex min-h-screen bg-[#050505] text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111] border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent">
            Agent Dashboard
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive ? "bg-emerald-600/10 text-emerald-400 border border-emerald-500/20" : "text-gray-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {link.icon}
                <span className="font-medium">{link.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
