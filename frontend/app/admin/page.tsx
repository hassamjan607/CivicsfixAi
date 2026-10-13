"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Building2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Users, 
  ArrowRight, 
  Loader2,
  Sparkles,
  Layers,
  RotateCcw,
  ShieldCheck,
  Flame
} from "lucide-react";

interface AdminStats {
  totalComplaints: number;
  resolvedComplaints: number;
  pendingComplaints: number;
  overdueComplaints: number;
  reopenedComplaints: number;
  departmentsCount: number;
  usersCount: number;
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [urgentComplaints, setUrgentComplaints] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/stats").then((r) => r.json()),
      fetch("/api/complaints").then((r) => r.json()),
    ])
      .then(([statsData, compData]) => {
        if (statsData.stats) setStats(statsData.stats);
        if (compData.complaints) {
          // Filter urgent ones
          const urgent = compData.complaints
            .filter((c: any) => c.urgency >= 7 && c.status !== "CONFIRMED")
            .slice(0, 5);
          setUrgentComplaints(urgent);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  const resolutionRate = stats && stats.totalComplaints > 0
    ? Math.round((stats.resolvedComplaints / stats.totalComplaints) * 100)
    : 0;

  const reopenRate = stats && stats.totalComplaints > 0
    ? Math.round((stats.reopenedComplaints / stats.totalComplaints) * 100)
    : 0;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            City Executive Overview
          </h1>
          <p className="text-xs text-slate-500">
            Real-time municipal performance, SLA compliance, and cross-department telemetry
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/admin/complaints"
            className="bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
          >
            <span>Complaints Ledger</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Total Grievances
          </span>
          <div className="text-3xl font-black text-slate-900 font-mono">
            {loading ? "..." : stats?.totalComplaints}
          </div>
          <p className="text-xs text-slate-500 font-medium">Logged in municipal system</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold text-teal-700 uppercase tracking-wider block">
            Verified Resolution Rate
          </span>
          <div className="text-3xl font-black text-[#0D7377] font-mono">
            {loading ? "..." : `${resolutionRate}%`}
          </div>
          <p className="text-xs text-slate-500 font-medium">{stats?.resolvedComplaints} closed with proof</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
            SLA Overdue Escalations
          </span>
          <div className="text-3xl font-black text-amber-700 font-mono">
            {loading ? "..." : stats?.overdueComplaints}
          </div>
          <p className="text-xs text-slate-500 font-medium">Requires supervisor intervention</p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-2xs space-y-2">
          <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
            Citizen Reopen Rate
          </span>
          <div className="text-3xl font-black text-rose-700 font-mono">
            {loading ? "..." : `${reopenRate}%`}
          </div>
          <p className="text-xs text-slate-500 font-medium">{stats?.reopenedComplaints} tickets reopened</p>
        </div>
      </div>

      {/* 2-Column Section: Urgent Complaints & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Urgent High-Risk Complaints */}
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-600" />
              <span>Priority Urgent Hazards (Urgency 7-10)</span>
            </h2>
            <Link href="/admin/complaints" className="text-xs font-bold text-[#0D7377] hover:underline">
              View All
            </Link>
          </div>

          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading urgent tickets...</div>
          ) : urgentComplaints.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">No active critical emergencies.</div>
          ) : (
            <div className="space-y-2.5">
              {urgentComplaints.map((comp) => (
                <div
                  key={comp.id}
                  className="p-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all flex items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs bg-white text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                        {comp.trackingId}
                      </span>
                      <span className="text-xs font-bold text-teal-800">{comp.category}</span>
                      <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full">
                        Score {comp.urgency}/10
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900 truncate max-w-md">
                      {comp.summary}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {comp.address} • Due: {new Date(comp.slaDueAt).toLocaleString()}
                    </div>
                  </div>

                  <Link
                    href={`/track/${comp.trackingId}`}
                    className="text-xs font-bold text-[#0D7377] hover:underline shrink-0"
                  >
                    Inspect
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Category Breakdown & Operations telemetry */}
        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#0D7377]" />
            <span>Active Municipal Distribution</span>
          </h2>

          <div className="space-y-3 text-xs">
            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Water and Sanitation (WASA)</span>
                <span>65% Volume</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-[#0D7377] rounded-full w-[65%]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between font-bold text-slate-700">
                <span>Traffic & Road Maintenance (TEPA)</span>
                <span>35% Volume</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full bg-amber-600 rounded-full w-[35%]" />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Registered Staff</span>
              <span className="text-lg font-black text-slate-900 font-mono">{stats?.usersCount}</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase block">Active Depts</span>
              <span className="text-lg font-black text-slate-900 font-mono">{stats?.departmentsCount}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
