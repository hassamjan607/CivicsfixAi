"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { 
  Wrench, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  Navigation, 
  AlertTriangle, 
  Loader2,
  Calendar
} from "lucide-react";

interface JobItem {
  id: string;
  trackingId: string;
  category: string;
  summary: string;
  description: string;
  address: string;
  lat?: number | null;
  lng?: number | null;
  status: "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CONFIRMED";
  urgency: number;
  slaDueAt: string;
  createdAt: string;
}

export default function WorkerDashboardPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const [activeTab, setActiveTab] = useState<"active" | "completed">(
    tabParam === "completed" ? "completed" : "active"
  );

  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/complaints")
      .then((res) => res.json())
      .then((data) => {
        if (data.complaints) setJobs(data.complaints);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeJobs = jobs.filter((j) => j.status === "ASSIGNED" || j.status === "IN_PROGRESS");
  const completedJobs = jobs.filter((j) => j.status === "RESOLVED" || j.status === "CONFIRMED");

  const displayedJobs = activeTab === "active" ? activeJobs : completedJobs;

  return (
    <div className="space-y-4">
      {/* Tab Switcher */}
      <div className="flex bg-slate-200 p-1 rounded-2xl">
        <button
          onClick={() => setActiveTab("active")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "active" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
          }`}
        >
          Today&apos;s Active Jobs ({activeJobs.length})
        </button>
        <button
          onClick={() => setActiveTab("completed")}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === "completed" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600"
          }`}
        >
          Resolved History ({completedJobs.length})
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-amber-600 mb-2" />
          <span>Fetching assigned work orders...</span>
        </div>
      ) : displayedJobs.length === 0 ? (
        <div className="bg-white rounded-3xl p-10 text-center text-slate-500 text-xs border border-slate-200 space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="font-bold text-slate-800">
            {activeTab === "active" ? "All Caught Up!" : "No completed jobs yet."}
          </p>
          <p className="text-slate-400">
            {activeTab === "active" ? "No outstanding field jobs assigned to your queue." : ""}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayedJobs.map((job) => {
            const isDueSoon = new Date(job.slaDueAt).getTime() - Date.now() < 3600000 * 4;
            return (
              <div
                key={job.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-3 hover:border-amber-400 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {job.trackingId}
                    </span>
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full">
                      {job.category}
                    </span>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    job.status === "IN_PROGRESS"
                      ? "bg-indigo-100 text-indigo-800"
                      : job.status === "RESOLVED"
                      ? "bg-teal-100 text-teal-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {job.status === "IN_PROGRESS" ? "In Progress" : job.status}
                  </span>
                </div>

                <Link
                  href={`/worker/jobs/${job.id}`}
                  className="block font-bold text-sm text-slate-900 hover:text-amber-800 transition-colors"
                >
                  {job.summary}
                </Link>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
                  <div className="flex items-center gap-1.5 truncate max-w-[200px]">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="truncate">{job.address}</span>
                  </div>

                  <div className="flex items-center gap-1 font-mono font-bold text-amber-700 text-[11px] shrink-0">
                    <Clock className="w-3.5 h-3.5" />
                    <span>SLA: {new Date(job.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>

                {/* Bottom Action Bar */}
                <div className="flex items-center gap-2 pt-2">
                  <a
                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-slate-50"
                  >
                    <Navigation className="w-3.5 h-3.5 text-slate-400" />
                    <span>Open in Maps</span>
                  </a>

                  <Link
                    href={`/worker/jobs/${job.id}`}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Open Work Order</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
