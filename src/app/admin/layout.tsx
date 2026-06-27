"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, Search, Users, CalendarCheck, LogOut, KanbanSquare, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { createClient } from "@/utils/supabase/client";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const supabase = createClient();
  const [isCollapsed, setIsCollapsed] = useState(false);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const navLinks = [
    { href: "/admin/scraper", label: "Live Scraper", icon: <Search className="w-4 h-4" /> },
    { href: "/admin/database", label: "Master Database", icon: <Database className="w-4 h-4" /> },
    { href: "/admin/agents", label: "Agents & Performance", icon: <Users className="w-4 h-4" /> },
    { href: "/admin/follow-ups", label: "Global Follow-ups", icon: <CalendarCheck className="w-4 h-4" /> },
    { href: "/admin/pipeline", label: "Global Pipeline", icon: <KanbanSquare className="w-4 h-4" /> },
    { href: "/admin/proposals", label: "Proposals & Quotes", icon: <FileText className="w-4 h-4" /> },
  ];

  return (
    <div className="flex min-h-screen bg-gray-50 text-gray-900">
      {/* Sidebar */}
      <aside className={`${isCollapsed ? "w-16" : "w-52"} bg-white border-r border-gray-200 flex flex-col transition-all duration-300 relative shrink-0`}>
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          {!isCollapsed && (
            <h1 className="text-lg font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent truncate">
              Admin Portal
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
                  isActive ? "bg-blue-600/10 text-blue-400 border border-blue-500/20" : "text-gray-600 hover:bg-white/5 hover:text-gray-900"
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
    </div>
  );
}
