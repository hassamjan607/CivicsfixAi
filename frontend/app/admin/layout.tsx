"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Building2, 
  LayoutDashboard, 
  FileText, 
  Users, 
  Layers, 
  ShieldAlert, 
  Mail, 
  Sliders, 
  LogOut, 
  ChevronDown,
  Globe
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, isRtl } = useLanguage();
  const [adminName, setAdminName] = useState("City Admin");
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.name) setAdminName(data.user.name);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const navItems = [
    { href: "/admin", label: "City Overview", icon: LayoutDashboard },
    { href: "/admin/complaints", label: "Complaints Table", icon: FileText },
    { href: "/admin/users", label: "Users & Staff", icon: Users },
    { href: "/admin/departments", label: "Departments", icon: Layers },
    { href: "/admin/audit", label: "Audit Log", icon: ShieldAlert },
    { href: "/admin/emails", label: "Email Outbox", icon: Mail },
    { href: "/admin/simulator", label: "Rules Simulator", icon: Sliders },
  ];

  return (
    <div className={`min-h-screen bg-slate-100 text-slate-900 flex font-sans ${isRtl ? "rtl" : "ltr"}`}>
      {/* Desktop Sidebar */}
      <aside className="w-64 bg-[#0B1E36] text-white flex-col justify-between hidden md:flex shrink-0">
        <div>
          <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-sm">
              CF
            </div>
            <div>
              <span className="font-extrabold text-base tracking-tight text-white block leading-tight">
                CivicFix AI
              </span>
              <span className="text-[10px] text-teal-400 font-bold uppercase tracking-wider">
                City Administration
              </span>
            </div>
          </div>

          <nav className="p-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#0D7377] text-white shadow-xs font-extrabold"
                      : "text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                {adminName.charAt(0)}
              </div>
              <div>
                <div className="text-xs font-bold text-white truncate max-w-[110px]">
                  {adminName}
                </div>
                <div className="text-[10px] text-slate-400">System Admin</div>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-colors"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 h-16 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-sm text-slate-900 md:hidden">
              CivicFix Admin
            </span>
          </div>

          <div className="flex items-center space-x-3">
            {/* Language Switcher */}
            <div className="bg-slate-100 p-0.5 rounded-full border border-slate-200 flex items-center text-xs font-bold">
              <button
                onClick={() => setLang("en")}
                className={`px-2 py-0.5 rounded-full text-[11px] ${
                  lang === "en" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("ur")}
                className={`px-2 py-0.5 rounded-full text-[11px] ${
                  lang === "ur" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                }`}
              >
                اردو
              </button>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs font-bold text-slate-600 hover:text-rose-600 flex items-center gap-1.5 md:hidden"
            >
              <LogOut className="w-4 h-4" />
              <span>Exit</span>
            </button>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
