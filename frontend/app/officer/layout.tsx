"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Shield, 
  Users, 
  LayoutDashboard, 
  Bell, 
  LogOut, 
  Building2, 
  ChevronDown, 
  Sparkles,
  ArrowRight
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface OfficerSession {
  userId: string;
  name: string;
  email: string;
  role: string;
  departmentId?: string;
}

export default function OfficerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, isRtl } = useLanguage();

  const [user, setUser] = useState<OfficerSession | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});

    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (data.unreadCount !== undefined) setUnreadCount(data.unreadCount);
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { href: "/officer", label: "Department Queue", icon: LayoutDashboard },
    { href: "/officer/team", label: "Team & Field Staff", icon: Users },
  ];

  return (
    <div className={`min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans ${isRtl ? "rtl" : "ltr"}`}>
      {/* Officer Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/officer" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#0D7377] flex items-center justify-center text-white font-extrabold text-sm shadow-md">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-base tracking-tight text-slate-900 block leading-tight">
                    CivicFix AI
                  </span>
                  <span className="bg-teal-100 text-[#0D7377] text-[10px] font-bold px-2 py-0.5 rounded-full">
                    Officer Desk
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 font-semibold">
                  Department-Scoped Triage & Dispatch
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                    isActive
                      ? "bg-[#0D7377] text-white shadow-xs font-extrabold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Controls: Language, User */}
          <div className="flex items-center space-x-3">
            <div className="bg-slate-100 p-0.5 rounded-full border border-slate-200 flex items-center text-xs font-bold">
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-0.5 rounded-full transition-all text-[11px] ${
                  lang === "en" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("ur")}
                className={`px-2 py-0.5 rounded-full transition-all text-[11px] ${
                  lang === "ur" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                اردو
              </button>
            </div>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
              >
                <div className="w-8 h-8 rounded-full bg-[#0B1E36] text-teal-400 flex items-center justify-center font-bold text-xs shadow-xs">
                  {user?.name?.charAt(0) || "O"}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {user?.name || "Department Officer"}
                  </div>
                  <div className="text-[10px] text-teal-800 font-bold">Reviewer & Dispatcher</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user?.name}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user?.email}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-16">
        {children}
      </main>
    </div>
  );
}
