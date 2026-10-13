"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, ArrowLeft, ArrowRight, ShieldCheck, Sparkles, ExternalLink } from "lucide-react";

export default function TrackSearchPage() {
  const router = useRouter();
  const [trackingId, setTrackingId] = useState("");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackingId.trim()) return;
    router.push(`/track/${trackingId.trim().toUpperCase()}`);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-bold text-[#0D7377] hover:text-[#095256] flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-sm text-slate-900">CivicFix AI</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-semibold">Public Complaint Tracker</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 sm:px-6 py-16 space-y-8">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0D7377] flex items-center justify-center mx-auto shadow-sm">
            <Search className="w-6 h-6" />
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Track a Municipal Complaint
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            Enter your unique Tracking Reference (e.g. <span className="font-mono font-bold text-[#0D7377]">CF-1042</span>) received via SMS, voice assistant, or submission receipt.
          </p>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl space-y-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Tracking Reference ID
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. CF-1042"
                  value={trackingId}
                  onChange={(e) => setTrackingId(e.target.value)}
                  className="w-full text-xs font-mono font-bold pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all text-slate-800 uppercase"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-extrabold py-3.5 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
            >
              <span>Inspect Ticket Status & Proof</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Showcase Tickets */}
          <div className="pt-4 border-t border-slate-100 space-y-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Or Inspect Live Demo Tickets:
            </span>
            <div className="space-y-1.5">
              <Link
                href="/track/CF-1042"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-teal-50 border border-slate-100 hover:border-teal-200 transition-all text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-[#0D7377]">CF-1042</span>
                  <span className="text-slate-600 ml-2">Resolved • Awaiting Citizen Confirmation</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                href="/track/CF-1055"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-amber-50 border border-slate-100 hover:border-amber-200 transition-all text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-amber-700">CF-1055</span>
                  <span className="text-slate-600 ml-2">Reopened • Sewage Overflow Issue</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>

              <Link
                href="/track/CF-1018"
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-rose-50 border border-slate-100 hover:border-rose-200 transition-all text-xs"
              >
                <div>
                  <span className="font-mono font-bold text-rose-700">CF-1018</span>
                  <span className="text-slate-600 ml-2">Overdue • Escalated to Administrator</span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
