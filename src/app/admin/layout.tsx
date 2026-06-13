"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Search, Users, CalendarCheck, LogOut, KanbanSquare } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navLinks = [
    { href: "/admin/scraper", label: "Live Scraper", icon: <Search className="w-5 h-5" /> },
    { href: "/admin/database", label: "Master Database", icon: <Database className="w-5 h-5" /> },
    { href: "/admin/agents", label: "Agents & Performance", icon: <Users className="w-5 h-5" /> },
    { href: "/admin/follow-ups", label: "Global Follow-ups", icon: <CalendarCheck className="w-5 h-5" /> },
    { href: "/admin/pipeline", label: "Global Pipeline", icon: <KanbanSquare className="w-5 h-5" /> },
  ];

  return (
    <div className="flex min-h-screen bg-[#050505] text-white">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111] border-r border-gray-800 flex flex-col">
        <div className="p-6 border-b border-gray-800">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Admin Portal
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
                  isActive ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-gray-400 hover:bg-white/5 hover:text-white"
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
