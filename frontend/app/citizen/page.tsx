"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Mic, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  FileText, 
  Bell, 
  ExternalLink,
  ChevronRight,
  Sparkles,
  RotateCcw,
  ShieldCheck,
  Building2,
  Loader2
} from "lucide-react";

interface ComplaintItem {
  id: string;
  trackingId: string;
  category: string;
  summary: string;
  address: string;
  status: "SUBMITTED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CONFIRMED" | "REOPENED";
  urgency: number;
  slaDueAt: string;
  createdAt: string;
  department?: { name: string };
}

export default function CitizenDashboardPage() {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Citizen");

  useEffect(() => {
    // Fetch profile
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user?.name) setUserName(data.user.name);
      })
      .catch(() => {});

    // Fetch complaints
    fetch("/api/complaints")
      .then((res) => res.json())
      .then((data) => {
        if (data.complaints) {
          setComplaints(data.complaints);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeComplaints = complaints.filter(
    (c) => c.status === "SUBMITTED" || c.status === "ASSIGNED" || c.status === "IN_PROGRESS" || c.status === "REOPENED"
  );
  const awaitingConfirmation = complaints.filter((c) => c.status === "RESOLVED");
  const closedComplaints = complaints.filter((c) => c.status === "CONFIRMED");

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return <span className="bg-sky-100 text-sky-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Submitted</span>;
      case "ASSIGNED":
        return <span className="bg-indigo-100 text-indigo-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Assigned</span>;
      case "IN_PROGRESS":
        return <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">In Progress</span>;
      case "RESOLVED":
        return <span className="bg-teal-100 text-teal-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Needs Confirmation</span>;
      case "CONFIRMED":
        return <span className="bg-emerald-100 text-emerald-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Closed</span>;
      case "REOPENED":
        return <span className="bg-rose-100 text-rose-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">Reopened</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-[11px] font-bold px-2.5 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Greeting & Big Report Action Card */}
      <div className="bg-gradient-to-r from-[#0B1E36] via-[#0E2A4D] to-[#0D7377] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-2 max-w-xl">
          <div className="inline-flex items-center gap-1.5 bg-white/10 text-teal-300 border border-white/20 text-xs font-bold px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Civic Redressal Portal</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
            Assalam o Alaikum, {userName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            Have a problem on your street? Speak or submit it in seconds. We route it directly to the designated department team.
          </p>
        </div>

        {/* Big Report Button with Mic */}
        <Link
          href="/citizen/report"
          className="bg-white hover:bg-slate-50 text-[#0B1E36] font-extrabold text-sm sm:text-base py-4 px-6 rounded-2xl shadow-2xl transition-all flex items-center gap-3 active:scale-95 group shrink-0"
        >
          <div className="w-10 h-10 rounded-xl bg-[#0D7377] text-white flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
            <Mic className="w-5 h-5 text-teal-200" />
          </div>
          <div className="text-left">
            <div className="leading-tight">Report a Problem</div>
            <div className="text-[10px] text-slate-500 font-semibold">Voice, Text or Form</div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-400 group-hover:translate-x-1 transition-transform ml-1" />
        </Link>
      </div>

      {/* Action Required Banner when a complaint is RESOLVED */}
      {awaitingConfirmation.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500 to-teal-600 p-1 rounded-3xl shadow-md">
          <div className="bg-white rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                <span>Action Required ({awaitingConfirmation.length})</span>
              </div>
              <h3 className="text-base font-bold text-slate-900">
                A municipal crew marked your complaint fixed!
              </h3>
              <p className="text-xs text-slate-500">
                Please inspect the before & after photos and confirm if the work was completed satisfactorily.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {awaitingConfirmation.slice(0, 1).map((comp) => (
                <Link
                  key={comp.id}
                  href={`/citizen/complaints/${comp.id}`}
                  className="bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center gap-1.5"
                >
                  <span>Review {comp.trackingId}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Active Grievances</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-slate-900 font-mono mt-2">
            {loading ? "..." : activeComplaints.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Under field inspection / repair</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Awaiting Your Confirmation</span>
            <div className="w-8 h-8 rounded-xl bg-teal-50 text-[#0D7377] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-[#0D7377] font-mono mt-2">
            {loading ? "..." : awaitingConfirmation.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Marked fixed by worker</div>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500">Resolved & Closed</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-black text-emerald-700 font-mono mt-2">
            {loading ? "..." : closedComplaints.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Successfully resolved issues</div>
        </div>
      </div>

      {/* Recent Complaints List */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base font-bold text-slate-900">Your Complaints</h2>
            <p className="text-xs text-slate-500">Real-time status of your submissions</p>
          </div>
          <Link
            href="/citizen/complaints"
            className="text-xs font-bold text-[#0D7377] hover:underline flex items-center gap-1"
          >
            <span>View All</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            <span>Loading complaints from database...</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-xs space-y-3">
            <p>You haven&apos;t filed any complaints yet.</p>
            <Link
              href="/citizen/report"
              className="inline-flex items-center gap-1.5 bg-[#0D7377] text-white text-xs font-bold py-2.5 px-4 rounded-xl"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Submit your first complaint</span>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {complaints.slice(0, 5).map((comp) => (
              <Link
                key={comp.id}
                href={`/citizen/complaints/${comp.id}`}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-teal-50/40 border border-slate-100 hover:border-teal-200 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900">
                      {comp.trackingId}
                    </span>
                    <span className="text-slate-300">•</span>
                    <span className="text-xs font-semibold text-teal-800">
                      {comp.category}
                    </span>
                    {getStatusBadge(comp.status)}
                  </div>
                  <h4 className="text-sm font-bold text-slate-800 group-hover:text-[#0D7377] transition-colors">
                    {comp.summary}
                  </h4>
                  <p className="text-xs text-slate-500">
                    {comp.address} • Submitted {new Date(comp.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">
                      Urgency
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-900">
                      {comp.urgency}/10
                    </span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-[#0D7377] group-hover:translate-x-0.5 transition-all" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
