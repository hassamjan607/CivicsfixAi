"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Wrench, CheckCircle2, User, LogOut, Clock, Wifi } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, isRtl } = useLanguage();
  const [workerName, setWorkerName] = useState("Worker");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.name) setWorkerName(data.user.name);
      })
      .catch(() => {});
  }, []);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  return (
    <div className={`min-h-screen bg-slate-100/80 text-slate-900 flex flex-col font-sans ${isRtl ? "rtl" : "ltr"}`}>
      {/* Mobile-First Worker Header */}
      <header className="sticky top-0 z-40 bg-[#0B1E36] text-white px-4 py-3 border-b border-slate-800 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black text-xs">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-tight block leading-tight text-white">
                CivicFix Field Ops
              </span>
              <span className="text-[10px] text-amber-400 font-bold block">
                {workerName} • On Duty
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded-full">
              <Wifi className="w-3 h-3" />
              <span>Online</span>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs text-slate-300 hover:text-white p-1 rounded-lg"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 pb-20">
        {children}
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav 
        aria-label="Worker Mobile Navigation"
        className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-6 py-2 flex items-center justify-around shadow-2xl"
      >
        <Link
          href="/worker"
          className={`flex flex-col items-center py-1 transition-all ${
            pathname === "/worker" ? "text-amber-700 font-bold" : "text-slate-500"
          }`}
        >
          <Wrench className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">My Jobs</span>
        </Link>

        <Link
          href="/worker?tab=completed"
          className="flex flex-col items-center py-1 text-slate-500 hover:text-slate-800 transition-all"
        >
          <CheckCircle2 className="w-5 h-5" />
          <span className="text-[10px] mt-0.5">Resolved</span>
        </Link>
      </nav>
    </div>
  );
}
