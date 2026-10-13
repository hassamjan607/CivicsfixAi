"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Shield, Wrench, ArrowLeft, Loader2, Phone, Mail, CheckCircle2, Clock } from "lucide-react";

interface WorkerDetail {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  activeJobsCount: number;
}

export default function OfficerTeamPage() {
  const [workers, setWorkers] = useState<WorkerDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/officer/workers")
      .then((res) => res.json())
      .then((data) => {
        if (data.workers) setWorkers(data.workers);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Department Field Team
          </h1>
          <p className="text-xs text-slate-500">
            Field workers assigned under your department supervision
          </p>
        </div>

        <Link
          href="/officer"
          className="text-xs font-bold text-[#0D7377] hover:underline flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Queue</span>
        </Link>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-teal-600 mb-2" />
          <span>Loading field staff data...</span>
        </div>
      ) : workers.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-500 text-xs border border-slate-200">
          No workers registered in your department.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workers.map((w) => (
            <div
              key={w.id}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4 hover:border-teal-400 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0D7377] flex items-center justify-center font-bold text-base">
                    {w.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">{w.name}</h3>
                    <span className="text-[10px] font-semibold text-slate-400">{w.role}</span>
                  </div>
                </div>

                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full font-mono ${
                  w.activeJobsCount > 3 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
                }`}>
                  {w.activeJobsCount} Active Jobs
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>{w.email}</span>
                </div>
                {w.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    <span>{w.phone}</span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 text-center text-xs">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Avg Fix Time</span>
                  <span className="font-bold text-slate-900">4.2 Hours</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Overdue Count</span>
                  <span className="font-bold text-emerald-700">0 Overdue</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
