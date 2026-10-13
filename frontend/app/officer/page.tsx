"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Shield, 
  Users, 
  AlertTriangle, 
  Clock, 
  CheckCircle2, 
  Search, 
  Filter, 
  ArrowRight, 
  ChevronRight, 
  Loader2, 
  RotateCcw, 
  Sparkles,
  Building2,
  Wrench,
  X
} from "lucide-react";

interface ComplaintItem {
  id: string;
  trackingId: string;
  category: string;
  summary: string;
  description: string;
  address: string;
  status: "SUBMITTED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CONFIRMED" | "REOPENED";
  urgency: number;
  confidence: number;
  slaDueAt: string;
  escalated: boolean;
  createdAt: string;
  assignedWorker?: { id: string; name: string } | null;
  department?: { name: string; code: string };
}

interface WorkerItem {
  id: string;
  name: string;
  role: string;
  activeJobsCount: number;
}

export default function OfficerDashboardPage() {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"ALL" | "UNASSIGNED" | "IN_PROGRESS" | "NEEDS_REVIEW" | "OVERDUE" | "REOPENED">("ALL");

  // Assignment Modal State
  const [assignModalComplaint, setAssignModalComplaint] = useState<ComplaintItem | null>(null);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [assignInstructions, setAssignInstructions] = useState("");
  const [assigningLoading, setAssigningLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [compRes, workersRes] = await Promise.all([
        fetch("/api/complaints"),
        fetch("/api/officer/workers"),
      ]);

      const compData = await compRes.json();
      const workersData = await workersRes.json();

      if (compData.complaints) setComplaints(compData.complaints);
      if (workersData.workers) setWorkers(workersData.workers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const now = new Date().getTime();

  // KPIs
  const unassignedCount = complaints.filter((c) => c.status === "SUBMITTED").length;
  const inProgressCount = complaints.filter((c) => c.status === "IN_PROGRESS" || c.status === "ASSIGNED").length;
  const awaitingCitizenCount = complaints.filter((c) => c.status === "RESOLVED").length;
  const reopenedCount = complaints.filter((c) => c.status === "REOPENED").length;
  const overdueCount = complaints.filter(
    (c) => new Date(c.slaDueAt).getTime() < now && c.status !== "CONFIRMED"
  ).length;

  const handleAssignWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignModalComplaint || !selectedWorkerId) return;

    setAssigningLoading(true);
    try {
      const res = await fetch(`/api/complaints/${assignModalComplaint.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: selectedWorkerId,
          instructions: assignInstructions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Assignment failed");
      } else {
        setAssignModalComplaint(null);
        setSelectedWorkerId("");
        setAssignInstructions("");
        fetchData();
      }
    } catch {
      alert("Request failed");
    } finally {
      setAssigningLoading(false);
    }
  };

  // Filter complaints
  const filtered = complaints
    .filter((c) => {
      if (activeTab === "UNASSIGNED") return c.status === "SUBMITTED";
      if (activeTab === "IN_PROGRESS") return c.status === "ASSIGNED" || c.status === "IN_PROGRESS";
      if (activeTab === "NEEDS_REVIEW") return (c.confidence && c.confidence < 0.75) || c.urgency >= 8;
      if (activeTab === "OVERDUE") return new Date(c.slaDueAt).getTime() < now && c.status !== "CONFIRMED";
      if (activeTab === "REOPENED") return c.status === "REOPENED";
      return true;
    })
    .filter((c) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        c.trackingId.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // Primary: Urgency descending
      if (b.urgency !== a.urgency) return b.urgency - a.urgency;
      // Secondary: SLA due ascending (closest deadline first)
      return new Date(a.slaDueAt).getTime() - new Date(b.slaDueAt).getTime();
    });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Department Triage Desk
          </h1>
          <p className="text-xs text-slate-500">
            Review incoming complaints, adjust categories, and dispatch field workers
          </p>
        </div>

        <Link
          href="/officer/team"
          className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl shadow-2xs transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Users className="w-4 h-4 text-[#0D7377]" />
          <span>View Team Workloads ({workers.length})</span>
        </Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 sm:gap-4">
        <button
          onClick={() => setActiveTab("UNASSIGNED")}
          className={`p-4 rounded-3xl border text-left transition-all ${
            activeTab === "UNASSIGNED"
              ? "bg-sky-50 border-sky-400 ring-2 ring-sky-200"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 block">Unassigned</span>
          <span className="text-2xl font-black font-mono text-sky-700 block mt-1">
            {unassignedCount}
          </span>
          <span className="text-[10px] text-slate-400">Needs Worker</span>
        </button>

        <button
          onClick={() => setActiveTab("IN_PROGRESS")}
          className={`p-4 rounded-3xl border text-left transition-all ${
            activeTab === "IN_PROGRESS"
              ? "bg-indigo-50 border-indigo-400 ring-2 ring-indigo-200"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 block">In Progress</span>
          <span className="text-2xl font-black font-mono text-indigo-700 block mt-1">
            {inProgressCount}
          </span>
          <span className="text-[10px] text-slate-400">Field Active</span>
        </button>

        <button
          onClick={() => setActiveTab("ALL")}
          className="p-4 rounded-3xl bg-white border border-slate-200 text-left"
        >
          <span className="text-[11px] font-bold text-slate-500 block">Awaiting Citizen</span>
          <span className="text-2xl font-black font-mono text-teal-700 block mt-1">
            {awaitingCitizenCount}
          </span>
          <span className="text-[10px] text-slate-400">Proof Uploaded</span>
        </button>

        <button
          onClick={() => setActiveTab("REOPENED")}
          className={`p-4 rounded-3xl border text-left transition-all ${
            activeTab === "REOPENED"
              ? "bg-rose-50 border-rose-400 ring-2 ring-rose-200"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 block">Reopened</span>
          <span className="text-2xl font-black font-mono text-rose-700 block mt-1">
            {reopenedCount}
          </span>
          <span className="text-[10px] text-rose-500 font-semibold">Priority Triage</span>
        </button>

        <button
          onClick={() => setActiveTab("OVERDUE")}
          className={`p-4 rounded-3xl border text-left transition-all ${
            activeTab === "OVERDUE"
              ? "bg-amber-50 border-amber-400 ring-2 ring-amber-200"
              : "bg-white border-slate-200 hover:border-slate-300"
          }`}
        >
          <span className="text-[11px] font-bold text-slate-500 block">SLA Overdue</span>
          <span className="text-2xl font-black font-mono text-amber-700 block mt-1">
            {overdueCount}
          </span>
          <span className="text-[10px] text-amber-600 font-semibold">Escalated</span>
        </button>
      </div>

      {/* Queue Toolbar: Search & Tab Filters */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              placeholder="Filter by ticket ID, summary, street location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500 font-medium text-slate-800"
            />
          </div>

          {/* Queue Tab Buttons */}
          <div className="flex items-center gap-1.5 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            {(["ALL", "UNASSIGNED", "NEEDS_REVIEW", "REOPENED", "OVERDUE"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                  activeTab === tab
                    ? "bg-[#0D7377] text-white shadow-xs"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {tab === "ALL" && "All Department Queue"}
                {tab === "UNASSIGNED" && "Unassigned"}
                {tab === "NEEDS_REVIEW" && "Needs Review"}
                {tab === "REOPENED" && "Reopened"}
                {tab === "OVERDUE" && "Overdue"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Department Queue Cards */}
      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-teal-600 mb-2" />
          <span>Loading department complaints...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-500 text-xs border border-slate-200 space-y-2">
          <p>No complaints match the selected filter.</p>
          <button
            onClick={() => { setActiveTab("ALL"); setSearch(""); }}
            className="text-[#0D7377] font-bold underline"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((comp) => {
            const isOverdue = new Date(comp.slaDueAt).getTime() < now && comp.status !== "CONFIRMED";
            return (
              <div
                key={comp.id}
                className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-teal-400 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                      {comp.trackingId}
                    </span>
                    <span className="text-xs font-bold text-teal-800">
                      {comp.category}
                    </span>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full ${
                      comp.urgency >= 7 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                    }`}>
                      Urgency {comp.urgency}/10
                    </span>
                    {comp.status === "REOPENED" && (
                      <span className="bg-rose-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        Reopened by Citizen
                      </span>
                    )}
                    {isOverdue && (
                      <span className="bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        SLA Overdue
                      </span>
                    )}
                  </div>

                  <Link
                    href={`/officer/complaints/${comp.id}`}
                    className="text-base font-bold text-slate-900 hover:text-[#0D7377] transition-colors block"
                  >
                    {comp.summary}
                  </Link>

                  <p className="text-xs text-slate-500">
                    {comp.address} • Reported {new Date(comp.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Right side: Worker info & Action Bar */}
                <div className="flex items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100 shrink-0">
                  <div className="text-left md:text-right">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">
                      Assigned Worker
                    </span>
                    <span className="text-xs font-semibold text-slate-800">
                      {comp.assignedWorker ? comp.assignedWorker.name : "Unassigned"}
                    </span>
                  </div>

                  {/* Assign CTA Button */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAssignModalComplaint(comp)}
                      className="bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold py-2 px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5"
                    >
                      <Wrench className="w-3.5 h-3.5" />
                      <span>{comp.assignedWorker ? "Reassign" : "Assign"}</span>
                    </button>

                    <Link
                      href={`/officer/complaints/${comp.id}`}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
                      title="Inspect Full Complaint"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Worker Dialog */}
      {assignModalComplaint && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Dispatch Field Worker
                </h3>
                <p className="text-xs text-slate-500">
                  Ticket {assignModalComplaint.trackingId}: {assignModalComplaint.summary}
                </p>
              </div>
              <button
                onClick={() => setAssignModalComplaint(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAssignWorker} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Field Worker (Showing Department Workload)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                  {workers.map((w) => (
                    <label
                      key={w.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedWorkerId === w.id
                          ? "border-[#0D7377] bg-teal-50/60 ring-2 ring-teal-200"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="worker"
                          value={w.id}
                          checked={selectedWorkerId === w.id}
                          onChange={() => setSelectedWorkerId(w.id)}
                          className="w-4 h-4 text-teal-600 accent-[#0D7377]"
                        />
                        <div>
                          <span className="text-xs font-bold text-slate-900 block">{w.name}</span>
                          <span className="text-[10px] text-slate-500">{w.role}</span>
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono">
                        {w.activeJobsCount} Active Jobs
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Special Instructions or Equipment Notes
                </label>
                <textarea
                  rows={3}
                  value={assignInstructions}
                  onChange={(e) => setAssignInstructions(e.target.value)}
                  placeholder="e.g. Bring suction pump and high-pressure hose for main sewer line..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 font-medium text-slate-800 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignModalComplaint(null)}
                  className="text-xs font-bold text-slate-600 px-4 py-2.5 rounded-xl hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assigningLoading || !selectedWorkerId}
                  className="bg-[#0D7377] hover:bg-[#095256] disabled:opacity-50 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  {assigningLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Confirm Assignment & Notify Worker</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}