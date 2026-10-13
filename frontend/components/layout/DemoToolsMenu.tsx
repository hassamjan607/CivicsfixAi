"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Sparkles, 
  X, 
  User, 
  Shield, 
  Wrench, 
  Building2, 
  Clock, 
  Play, 
  ExternalLink,
  ChevronDown,
  Info
} from "lucide-react";

export default function DemoToolsMenu() {
  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
  const [isOpen, setIsOpen] = useState(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [cronMessage, setCronMessage] = useState<string | null>(null);
  const router = useRouter();

  if (!isDemoMode) return null;

  const handleDemoLogin = async (role: string) => {
    try {
      setLoadingRole(role);
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setIsOpen(false);
        router.push(data.redirect || `/${role}`);
        router.refresh();
      } else {
        alert(data.error || "Login failed");
      }
    } catch (e) {
      alert("Demo login error");
    } finally {
      setLoadingRole(null);
    }
  };

  const handleRunCron = async () => {
    try {
      setCronMessage("Running SLA checks & auto-close...");
      const res = await fetch("/api/admin/cron", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCronMessage(`✓ Done: ${data.message || "SLA checks executed"}`);
        setTimeout(() => setCronMessage(null), 4000);
      } else {
        setCronMessage(`Failed: ${data.error || "Cron error"}`);
      }
    } catch (e) {
      setCronMessage("Cron request failed");
    }
  };

  return (
    <>
      {/* Floating Demo Trigger Button */}
      <aside 
        aria-label="Demo Environment Quick Controls"
        className="fixed bottom-4 right-4 z-50 flex items-center"
      >
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="bg-[#0B1E36] hover:bg-[#0E2A4D] text-white px-3.5 py-2 rounded-full shadow-2xl border border-teal-500/30 flex items-center gap-2 text-xs font-bold transition-all transform hover:scale-105 active:scale-95"
          title="Open Demo Tools"
        >
          <Sparkles className="w-4 h-4 text-teal-400" />
          <span>Demo Tools</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        </button>
      </aside>

      {/* Demo Tools Popover Modal */}
      {isOpen && (
        <div 
          role="dialog"
          aria-modal="true"
          aria-label="Demo Environment Quick Controls"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-end sm:justify-end p-4 pointer-events-none"
        >
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs pointer-events-auto" onClick={() => setIsOpen(false)} />

          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-sm pointer-events-auto relative z-10 p-5 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0D7377] flex items-center justify-center font-bold">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Demo Environment</h3>
                  <p className="text-[11px] text-slate-500">1-click logins & test tickets</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick 1-Click Role Logins */}
            <div className="space-y-2">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Switch Role Instantly
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDemoLogin("citizen")}
                  disabled={loadingRole !== null}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-left transition-all flex items-center gap-2"
                >
                  <User className="w-4 h-4 text-slate-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Citizen</div>
                    <div className="text-[10px] text-slate-500">Hassam Jan</div>
                  </div>
                </button>

                <button
                  onClick={() => handleDemoLogin("officer")}
                  disabled={loadingRole !== null}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-left transition-all flex items-center gap-2"
                >
                  <Shield className="w-4 h-4 text-teal-700" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Officer</div>
                    <div className="text-[10px] text-slate-500">WASA Officer</div>
                  </div>
                </button>

                <button
                  onClick={() => handleDemoLogin("worker")}
                  disabled={loadingRole !== null}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-left transition-all flex items-center gap-2"
                >
                  <Wrench className="w-4 h-4 text-amber-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Worker</div>
                    <div className="text-[10px] text-slate-500">Field Staff</div>
                  </div>
                </button>

                <button
                  onClick={() => handleDemoLogin("admin")}
                  disabled={loadingRole !== null}
                  className="p-2.5 rounded-xl border border-slate-200 hover:border-teal-500 hover:bg-teal-50/50 text-left transition-all flex items-center gap-2"
                >
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="text-xs font-bold text-slate-900">Admin</div>
                    <div className="text-[10px] text-slate-500">City Admin</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Showcase Demo Tickets */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Showcase Complaints
              </span>
              <div className="space-y-1">
                <a
                  href="/track/CF-1042"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs transition-all"
                >
                  <div>
                    <span className="font-mono font-bold text-teal-700">CF-1042</span>
                    <span className="text-slate-500 ml-2">Awaiting Citizen Confirmation</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>

                <a
                  href="/track/CF-1055"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs transition-all"
                >
                  <div>
                    <span className="font-mono font-bold text-amber-700">CF-1055</span>
                    <span className="text-slate-500 ml-2">Reopened Complaint</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>

                <a
                  href="/track/CF-1018"
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-xs transition-all"
                >
                  <div>
                    <span className="font-mono font-bold text-rose-700">CF-1018</span>
                    <span className="text-slate-500 ml-2">SLA Overdue / Escalated</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                </a>
              </div>
            </div>

            {/* Run Background Cron / Escalations */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Background Engine
              </span>
              <button
                onClick={handleRunCron}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all"
              >
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Trigger SLA Checks & Auto-Close</span>
              </button>
              {cronMessage && (
                <p className="text-[11px] text-teal-700 bg-teal-50 p-2 rounded-lg font-medium">
                  {cronMessage}
                </p>
              )}
            </div>

            <div className="text-[10px] text-slate-400 pt-1 text-center">
              All demo passwords: <span className="font-mono font-semibold text-slate-600">Password123!</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
