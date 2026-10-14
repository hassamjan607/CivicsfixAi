"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { 
  Mic, 
  Camera, 
  Sparkles, 
  ShieldCheck, 
  CheckCircle2, 
  ArrowRight, 
  Search, 
  Users, 
  Wrench, 
  Building2, 
  Clock, 
  Lock, 
  Volume2, 
  ChevronRight, 
  ChevronDown,
  Layers,
  PhoneCall,
  Activity,
  Award
} from "lucide-react";
import { useLanguage } from "@/lib/i18n";

interface ImpactStats {
  totalComplaints: number;
  resolvedCount: number;
  inProgressCount: number;
  departmentsCount: number;
}

export default function LandingPage() {
  const { lang, setLang, t, isRtl } = useLanguage();
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [trackingInput, setTrackingInput] = useState("");

  const handleHeroMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pctX = (x / rect.width).toFixed(3);
    const pctY = (y / rect.height).toFixed(3);
    e.currentTarget.style.setProperty("--mouse-x", `${x}px`);
    e.currentTarget.style.setProperty("--mouse-y", `${y}px`);
    e.currentTarget.style.setProperty("--mouse-pct-x", pctX);
    e.currentTarget.style.setProperty("--mouse-pct-y", pctY);
    e.currentTarget.style.setProperty("--mouse-active", "1");
  };

  const handleHeroMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    e.currentTarget.style.setProperty("--mouse-active", "0");
  };

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.stats) {
          setStats(data.stats);
        }
      })
      .catch((err) => console.error("Error loading stats:", err));
  }, []);

  const faqs = [
    {
      q: "How does CivicFix score the urgency of my complaint?",
      a: "Our explainable urgency engine calculates a score from 1 to 10 based on safety hazards, environmental health risks, weather vulnerability (e.g. rain forecasts for sewage overflows), proximity to sensitive zones (schools, hospitals), and repeated community reports."
    },
    {
      q: "Can I record a complaint in Urdu or Punjabi?",
      a: "Yes! CivicFix supports native voice recording with real-time speech recognition in Urdu, English, and Roman Urdu. You speak naturally, and our system transcribes and routes the grievance."
    },
    {
      q: "How do I know my problem was genuinely fixed?",
      a: "Field workers are required to capture and upload a geo-tagged 'After' photograph upon completion. You will receive an alert to review the Before & After proof. If the issue is not fixed, you can reopen it with a single tap."
    },
    {
      q: "Can I report a problem anonymously without creating an account?",
      a: "Yes. You can report as a guest and receive a unique tracking ID (e.g. CF-1042) to monitor progress publicly at any time without entering private credentials."
    },
    {
      q: "What happens if a municipal department misses the SLA deadline?",
      a: "If the resolution deadline is breached, the ticket is automatically escalated to city administrators, marked overdue in the officer queue, and flagged for priority field intervention."
    }
  ];

  return (
    <div className={`min-h-screen bg-slate-50 text-slate-900 ${isRtl ? "rtl" : "ltr"}`}>
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <img
              src="/logo.jpg"
              alt="CivicFix AI Logo"
              className="w-10 h-10 rounded-xl object-cover shadow-md ring-2 ring-teal-500/30 group-hover:scale-105 transition-transform"
            />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-tight text-slate-900">
                  CivicFix AI
                </span>
                <span className="bg-teal-50 text-[#0D7377] border border-teal-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                  City Triage
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Municipal Grievance Redressal
              </p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-600">
            <Link href="/about" className="hover:text-[#0D7377] transition-colors">
              About & Urgency Engine
            </Link>
            <Link href="/track" className="hover:text-[#0D7377] transition-colors">
              Track Status
            </Link>
            <Link href="/admin/simulator" className="hover:text-[#0D7377] transition-colors">
              Rules Simulator
            </Link>
          </nav>

          <div className="flex items-center space-x-3">
            {/* Language Switcher */}
            <div className="bg-slate-100 p-0.5 rounded-full border border-slate-200 flex items-center text-xs font-bold">
              <button
                onClick={() => setLang("en")}
                className={`px-2.5 py-1 rounded-full transition-all ${
                  lang === "en" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("ur")}
                className={`px-2.5 py-1 rounded-full transition-all ${
                  lang === "ur" ? "bg-white text-slate-900 shadow-xs font-bold" : "text-slate-500 hover:text-slate-800"
                }`}
              >
                اردو
              </button>
            </div>

            <Link
              href="/login"
              className="text-xs font-bold text-slate-700 hover:text-slate-900 px-3 py-2 rounded-xl transition-all"
            >
              Sign In
            </Link>

            <Link
              href="/citizen/report"
              className="bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold px-4 py-2 rounded-xl shadow-md transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Report</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section with Interactive Blue Shading & Cursor-Following Spotlight */}
      <section 
        onMouseMove={handleHeroMouseMove}
        onMouseLeave={handleHeroMouseLeave}
        className="relative overflow-hidden hero-animated-bg text-white py-8 sm:py-12 lg:py-14 select-none cursor-default"
      >
        {/* Interactive Cursor Spotlight Glow (Follows mouse across the hero) */}
        <div className="hero-cursor-glow" />
        <div className="hero-cursor-beam" />

        {/* Ambient Aurora Glow Orbs in Deep Ocean & Sapphire Blue */}
        <div className="absolute top-1/4 left-1/3 -translate-x-1/2 -translate-y-1/2 w-[460px] h-[460px] bg-cyan-500/20 rounded-full blur-[100px] pointer-events-none aurora-orb-1" />
        <div className="absolute top-1/3 right-1/4 w-[420px] h-[420px] bg-[#0e3860]/45 rounded-full blur-[110px] pointer-events-none aurora-orb-2" />
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[520px] h-[350px] bg-sky-600/20 rounded-full blur-[120px] pointer-events-none aurora-orb-3" />

        {/* Decorative Grid Mesh that lights up near cursor */}
        <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" />

        <div className="relative max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-400/30 text-teal-300 px-3.5 py-1 rounded-full text-xs font-bold mb-4 shadow-xs backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Voice-First AI Grievance Management</span>
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight max-w-3xl mx-auto leading-tight sm:leading-tight text-white drop-shadow-sm">
            Speak your problem, we make sure the{" "}
            <span className="text-gradient-flow font-black inline-block">
              right team fixes it.
            </span>
          </h1>

          <p className="mt-3 text-sm sm:text-base lg:text-lg text-slate-200 max-w-2xl mx-auto leading-relaxed">
            Report broken drains, damaged roads, or power hazards by voice in Urdu or English.
            AI classifies the department, scores urgency with clear reasons, and alerts field teams instantly.
          </p>

          {/* Primary Action Buttons */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/citizen/report"
              className="w-full sm:w-auto bg-[#0D7377] hover:bg-[#095256] text-white font-extrabold text-sm sm:text-base px-6 py-3 rounded-xl shadow-lg shadow-teal-900/40 transition-all flex items-center justify-center gap-2.5 active:scale-95 group"
            >
              <Mic className="w-4 h-4 text-teal-300 group-hover:scale-110 transition-transform" />
              <span>Report a Problem</span>
              <ArrowRight className="w-4 h-4 text-teal-300" />
            </Link>

            <Link
              href="/track"
              className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-sm sm:text-base px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4 text-slate-300" />
              <span>Track a Complaint</span>
            </Link>
          </div>

          {/* Quick Track Input Bar */}
          <div className="mt-6 max-w-md mx-auto bg-white/10 backdrop-blur-md p-1.5 rounded-xl border border-white/20 flex items-center gap-2 shadow-xl">
            <Search className="w-4 h-4 text-slate-400 ml-2 shrink-0" />
            <input
              type="text"
              placeholder="e.g. CF-1042 or tracking ID"
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              className="bg-transparent text-xs sm:text-sm text-white placeholder-slate-400 outline-none flex-1 px-2"
            />
            <Link
              href={trackingInput.trim() ? `/track/${trackingInput.trim().toUpperCase()}` : "/track"}
              className="bg-teal-500 hover:bg-teal-400 text-[#0B1E36] font-bold text-xs px-3.5 py-2 rounded-lg transition-all shrink-0"
            >
              Lookup
            </Link>
          </div>
        </div>
      </section>

      {/* Impact Counters (Derived ONLY from Real Database Counts) */}
      <section className="bg-white border-y border-slate-200 py-10 sm:py-12">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-6">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
              Live Verified Database Impact
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            <div className="p-5 sm:p-6 rounded-3xl bg-slate-50 border border-slate-200/80 shadow-xs">
              <div className="text-3xl sm:text-4xl font-black text-[#0B1E36] font-mono tracking-tight">
                {stats ? stats.totalComplaints : "..."}
              </div>
              <div className="text-xs sm:text-sm font-bold text-slate-600 mt-1">Total Reported</div>
            </div>

            <div className="p-5 sm:p-6 rounded-3xl bg-teal-50/70 border border-teal-200/80 shadow-xs">
              <div className="text-3xl sm:text-4xl font-black text-[#0D7377] font-mono tracking-tight">
                {stats ? stats.resolvedCount : "..."}
              </div>
              <div className="text-xs sm:text-sm font-bold text-teal-900 mt-1">Verified Resolved</div>
            </div>

            <div className="p-5 sm:p-6 rounded-3xl bg-amber-50/70 border border-amber-200/80 shadow-xs">
              <div className="text-3xl sm:text-4xl font-black text-amber-700 font-mono tracking-tight">
                {stats ? stats.inProgressCount : "..."}
              </div>
              <div className="text-xs sm:text-sm font-bold text-amber-900 mt-1">Active In-Field</div>
            </div>

            <div className="p-5 sm:p-6 rounded-3xl bg-indigo-50/70 border border-indigo-200/80 shadow-xs">
              <div className="text-3xl sm:text-4xl font-black text-indigo-700 font-mono tracking-tight">
                {stats ? stats.departmentsCount : "..."}
              </div>
              <div className="text-xs sm:text-sm font-bold text-indigo-900 mt-1">Municipal Depts</div>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works in 4 Steps (Speak, Snap, Score, Fix) */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <div className="inline-flex items-center gap-2 bg-teal-100 text-[#0D7377] text-xs sm:text-sm font-extrabold px-3.5 py-1 rounded-full mb-3">
              <span>Streamlined Lifecycle</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
              How CivicFix Resolves Issues in 4 Steps
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              From voice intake to verified visual proof, every grievance is tracked with complete accountability.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Step 1: Speak */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm relative hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0D7377] flex items-center justify-center font-black text-lg mb-4 border border-teal-100 shadow-xs">
                <Mic className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-teal-700 block mb-1">
                Step 1: Speak
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Speak or Type</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Describe the problem naturally in Urdu or English. No complicated bureaucratic forms required.
              </p>
            </div>

            {/* Step 2: Snap */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm relative hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center font-black text-lg mb-4 border border-sky-100 shadow-xs">
                <Camera className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-sky-700 block mb-1">
                Step 2: Snap
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Snap & Locate</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Attach a photo from your camera. Your device automatically detects the exact GPS coordinates.
              </p>
            </div>

            {/* Step 3: Score */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm relative hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center font-black text-lg mb-4 border border-amber-100 shadow-xs">
                <Sparkles className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-amber-700 block mb-1">
                Step 3: Score
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">AI Urgency Engine</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Transparent rules evaluate risk, weather forecasts, and sensitive locations to establish a real SLA.
              </p>
            </div>

            {/* Step 4: Fix */}
            <div className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200 shadow-sm relative hover:shadow-md transition-all">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-black text-lg mb-4 border border-emerald-100 shadow-xs">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 block mb-1">
                Step 4: Fix
              </span>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Verified Resolution</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                The field worker uploads an &apos;After&apos; photo. You confirm whether the issue was fixed or reopen it with 1 tap.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Role Cards: Built for Every Stakeholder */}
      <section className="py-16 sm:py-20 bg-white border-y border-slate-200">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
              One Unified System, Scoped for Every Role
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              Role-based security ensures each participant sees only the scope they are responsible for.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {/* For Citizens */}
            <div className="rounded-3xl border border-slate-200 p-6 sm:p-8 bg-slate-50 hover:border-teal-500 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#0B1E36] text-white flex items-center justify-center mb-5 shadow-md">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">For Citizens</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                  Personal dashboard to track all your reports, inspect urgency reasons, receive email updates, and verify before/after repairs.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Urdu and English voice intake</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Real-time SLA countdown clock</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>1-click confirm or reopen proof slider</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-200">
                <Link
                  href="/register"
                  className="text-xs sm:text-sm font-bold text-[#0D7377] hover:underline flex items-center gap-1.5"
                >
                  <span>Register as Citizen</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* For Officers */}
            <div className="rounded-3xl border border-teal-200 p-6 sm:p-8 bg-teal-50/40 hover:border-teal-500 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-[#0D7377] text-white flex items-center justify-center mb-5 shadow-md">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">For Department Officers</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                  Department-scoped queue (WASA, TEPA, etc.) to review incoming tickets, adjust categories, and assign jobs to available workers.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Urgency-ranked triage queue</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Field worker workload balancing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Auto-escalation monitoring</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-5 border-t border-teal-200/80">
                <Link
                  href="/login"
                  className="text-xs sm:text-sm font-bold text-[#0D7377] hover:underline flex items-center gap-1.5"
                >
                  <span>Officer Portal Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* For Field Workers */}
            <div className="rounded-3xl border border-slate-200 p-6 sm:p-8 bg-slate-50 hover:border-teal-500 hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center mb-5 shadow-md">
                  <Wrench className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">For Field Workers</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed mb-5">
                  Mobile-first task queue with turn-by-turn navigation, voice notes, material logs, and mandatory camera proof upload.
                </p>
                <ul className="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-700">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Nearest jobs prioritized by SLA</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Direct device camera upload for &apos;After&apos; photo</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span>Works with offline fallback queue</span>
                  </li>
                </ul>
              </div>
              <div className="mt-6 pt-5 border-t border-slate-200">
                <Link
                  href="/login"
                  className="text-xs sm:text-sm font-bold text-amber-700 hover:underline flex items-center gap-1.5"
                >
                  <span>Field Staff Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Key Features Overview */}
      <section className="py-16 sm:py-20 bg-slate-50">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
              Core Platform Capabilities
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              Engineered for complete transparency, auditability, and speed.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D7377] flex items-center justify-center mb-4 border border-teal-100 shadow-xs">
                <Sparkles className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-1.5">Explainable Urgency</h4>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Scores 1-10 are accompanied by clear bullet points explaining weather risk, hazards, and recurrence count.
              </p>
            </div>

            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D7377] flex items-center justify-center mb-4 border border-teal-100 shadow-xs">
                <Volume2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-1.5">Bilingual Voice</h4>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Citizens can talk, type, or fill structured forms. Full Urdu speech synthesis and RTL layout support.
              </p>
            </div>

            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D7377] flex items-center justify-center mb-4 border border-teal-100 shadow-xs">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-1.5">Before & After Proof</h4>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Dual photographic slider lets citizens inspect the repair before signing off or reopening.
              </p>
            </div>

            <div className="p-6 sm:p-7 rounded-3xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all">
              <div className="w-10 h-10 rounded-xl bg-teal-50 text-[#0D7377] flex items-center justify-center mb-4 border border-teal-100 shadow-xs">
                <Lock className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-base text-slate-900 mb-1.5">Privacy & Security</h4>
              <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                Public track links mask citizen contact info. Staff accounts are strictly role-segregated on the server.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="py-16 sm:py-20 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-slate-600 text-sm sm:text-base">
              Answers to common questions about reporting, SLAs, and privacy.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-slate-200 bg-slate-50/60 overflow-hidden transition-all shadow-xs"
                >
                  <button
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full text-left p-5 flex items-center justify-between font-bold text-sm sm:text-base text-slate-900"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-400 transition-transform ${
                        isOpen ? "rotate-180 text-teal-600" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs sm:text-sm text-slate-600 leading-relaxed border-t border-slate-200/60 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B1E36] text-white py-12 border-t border-slate-800">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <Link href="/" className="flex items-center space-x-3 group">
              <img
                src="/logo.jpg"
                alt="CivicFix AI Logo"
                className="w-10 h-10 rounded-xl object-cover border border-teal-500/30 shadow-md group-hover:scale-105 transition-transform"
              />
              <div>
                <span className="font-extrabold text-base sm:text-lg tracking-tight text-white block">
                  CivicFix AI
                </span>
                <span className="text-xs text-slate-400">
                  Municipal Grievance Redressal Platform
                </span>
              </div>
            </Link>

            <div className="flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-slate-300 font-semibold">
              <Link href="/about" className="hover:text-white transition-colors">
                About & Rules
              </Link>
              <Link href="/track" className="hover:text-white transition-colors">
                Track Ticket
              </Link>
              <Link href="/admin/simulator" className="hover:text-white transition-colors">
                Rules Simulator
              </Link>
              <Link href="/login" className="hover:text-white transition-colors">
                Portal Login
              </Link>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400">
            <div>
              &copy; 2026 CivicFix AI. Powered by municipal intelligence.
            </div>
            <div className="mt-2 sm:mt-0 font-medium">
              English • اردو • Certified Responsive & Accessible
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
