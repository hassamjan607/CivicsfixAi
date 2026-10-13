"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
  Search, 
  Filter, 
  ChevronRight, 
  ArrowUpDown, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Building2, 
  Loader2,
  Plus
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

export default function CitizenComplaintsListPage() {
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<"urgency" | "newest">("newest");

  useEffect(() => {
    fetch("/api/complaints")
      .then((res) => res.json())
      .then((data) => {
        if (data.complaints) setComplaints(data.complaints);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = complaints
    .filter((c) => {
      if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          c.trackingId.toLowerCase().includes(query) ||
          c.summary.toLowerCase().includes(query) ||
          c.category.toLowerCase().includes(query) ||
          c.address.toLowerCase().includes(query)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortOrder === "urgency") {
        return b.urgency - a.urgency;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SUBMITTED":
        return <span className="bg-sky-100 text-sky-800 text-xs font-bold px-2.5 py-1 rounded-full">Submitted</span>;
      case "ASSIGNED":
        return <span className="bg-indigo-100 text-indigo-800 text-xs font-bold px-2.5 py-1 rounded-full">Assigned</span>;
      case "IN_PROGRESS":
        return <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full">In Progress</span>;
      case "RESOLVED":
        return <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-1 rounded-full">Needs Confirmation</span>;
      case "CONFIRMED":
        return <span className="bg-emerald-100 text-emerald-800 text-xs font-bold px-2.5 py-1 rounded-full">Closed</span>;
      case "REOPENED":
        return <span className="bg-rose-100 text-rose-800 text-xs font-bold px-2.5 py-1 rounded-full">Reopened</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 text-xs font-bold px-2.5 py-1 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Title and New Report Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            My Complaint History
          </h1>
          <p className="text-xs text-slate-500">
            All grievances filed by your citizen account
          </p>
        </div>

        <Link
          href="/citizen/report"
          className="bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold py-3 px-5 rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 self-start sm:self-auto active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Report New Problem</span>
        </Link>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search by ticket ID, category, street..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500 font-medium text-slate-800"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="ASSIGNED">Assigned</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RESOLVED">Needs Confirmation</option>
            <option value="CONFIRMED">Closed</option>
            <option value="REOPENED">Reopened</option>
          </select>

          <button
            onClick={() => setSortOrder(sortOrder === "newest" ? "urgency" : "newest")}
            className="text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            <span>Sort: {sortOrder === "newest" ? "Newest" : "Urgency"}</span>
          </button>
        </div>
      </div>

      {/* Complaints List Cards */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 text-xs">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
          <span>Loading complaints...</span>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center text-slate-500 text-xs border border-slate-200 space-y-3">
          <p>No complaints match your filters.</p>
          <button
            onClick={() => { setSearch(""); setStatusFilter("ALL"); }}
            className="text-[#0D7377] font-bold underline"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((comp) => (
            <Link
              key={comp.id}
              href={`/citizen/complaints/${comp.id}`}
              className="bg-white rounded-3xl p-5 border border-slate-200 hover:border-teal-400 shadow-2xs hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 group"
            >
              <div className="space-y-1.5 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2.5 py-0.5 rounded-lg border border-slate-200">
                    {comp.trackingId}
                  </span>
                  <span className="text-xs font-bold text-teal-800">
                    {comp.category}
                  </span>
                  {getStatusBadge(comp.status)}
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-[#0D7377] transition-colors">
                  {comp.summary}
                </h3>

                <p className="text-xs text-slate-500">
                  {comp.address} • Submitted {new Date(comp.createdAt).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center justify-between md:justify-end gap-6 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <div className="text-left md:text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    Urgency
                  </span>
                  <span className="text-sm font-mono font-black text-slate-900">
                    {comp.urgency} / 10
                  </span>
                </div>

                <div className="text-left md:text-right">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">
                    SLA Window
                  </span>
                  <span className="text-xs font-mono font-bold text-teal-700">
                    {new Date(comp.slaDueAt).toLocaleDateString()}
                  </span>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-[#0D7377] group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
