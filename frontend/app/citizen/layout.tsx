"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  LayoutDashboard, 
  Mic, 
  FileText, 
  Bell, 
  User, 
  LogOut, 
  Menu, 
  X, 
  Sparkles,
  ChevronDown,
  Globe
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface UserSession {
  userId: string;
  name: string;
  email: string;
  role: string;
}

export default function CitizenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t, isRtl } = useLanguage();

  const [user, setUser] = useState<UserSession | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    // Fetch current session
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) {
          setUser(data.user);
        }
      })
      .catch(() => {});

    // Fetch unread notifications
    fetch("/api/notifications")
      .then((res) => res.json())
      .then((data) => {
        if (data.unreadCount !== undefined) {
          setUnreadCount(data.unreadCount);
        }
      })
      .catch(() => {});
  }, [pathname]);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      router.push("/login");
    }
  };

  const navItems = [
    { href: "/citizen", label: "Dashboard", icon: LayoutDashboard },
    { href: "/citizen/report", label: "Report a Problem", icon: Mic, highlight: true },
    { href: "/citizen/complaints", label: "My Complaints", icon: FileText },
    { href: "/citizen/notifications", label: "Notifications", icon: Bell, badge: unreadCount },
    { href: "/citizen/profile", label: "Profile", icon: User },
  ];

  return (
    <div className={`min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans ${isRtl ? "rtl" : "ltr"}`}>
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/citizen" className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-2xl bg-[#0B1E36] flex items-center justify-center text-teal-400 font-extrabold text-sm shadow-md ring-2 ring-teal-500/20">
                CF
              </div>
              <div>
                <span className="font-black text-base tracking-tight text-slate-900 block leading-tight">
                  CivicFix AI
                </span>
                <span className="text-[10px] bg-teal-50 text-[#0D7377] font-bold px-1.5 py-0.2 rounded border border-teal-200">
                  Citizen Portal
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== "/citizen" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 relative ${
                    item.highlight
                      ? "bg-[#0D7377] text-white hover:bg-[#095256] shadow-xs"
                      : isActive
                      ? "bg-slate-100 text-slate-900 font-extrabold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                  {item.badge && item.badge > 0 ? (
                    <span className="w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-black flex items-center justify-center">
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>

          {/* Right Header Controls: Language, Notifications Bell, User Menu */}
          <div className="flex items-center space-x-3">
            {/* Language Switch */}
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

            {/* Notification Bell */}
            <Link
              href="/citizen/notifications"
              className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white animate-pulse" />
              )}
            </Link>

            {/* User Dropdown */}
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200"
              >
                <div className="w-8 h-8 rounded-full bg-[#0D7377] text-white flex items-center justify-center font-bold text-xs shadow-xs">
                  {user?.name?.charAt(0) || "C"}
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {user?.name || "Citizen"}
                  </div>
                  <div className="text-[10px] text-slate-500">Public User</div>
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden sm:block" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-200 py-1.5 z-50">
                  <div className="px-3.5 py-2 border-b border-slate-100">
                    <p className="text-xs font-bold text-slate-900">{user?.name || "Citizen"}</p>
                    <p className="text-[10px] text-slate-500 truncate">{user?.email || ""}</p>
                  </div>
                  <Link
                    href="/citizen/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>My Profile</span>
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-rose-600 hover:bg-rose-50 text-left border-t border-slate-100"
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

      {/* Main Content Viewport (Full desktop width up to 1440px) */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav 
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-3 py-2 flex items-center justify-around shadow-2xl"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all relative ${
                isActive ? "text-[#0D7377] font-bold" : "text-slate-500"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${item.highlight ? "text-[#0D7377]" : ""}`} />
                {item.badge && item.badge > 0 ? (
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-600 ring-2 ring-white" />
                ) : null}
              </div>
              <span className="text-[10px] mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
