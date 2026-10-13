"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Download, Filter, ChevronRight, Loader2, ArrowUpDown } from "lucide-react";

interface ComplaintRow {
  id: string;
  trackingId: string;
  category: string;
  summary: string;
  address: string;
  status: string;
  urgency: number;
  slaDueAt: string;
  createdAt: string;
  department?: { name: string; code: string };
  assignedWorker?: { name: string };
}

export default function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  useEffect(() => {
    fetch("/api/complaints")
      .then((r) => r.json())
      .then((data) => {
        if (data.complaints) setComplaints(data.complaints);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = complaints.filter((c) => {
    if (statusFilter !== "ALL" && c.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        c.trackingId.toLowerCase().includes(q) ||
        c.summary.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.address.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const exportCSV = () => {
    const headers = ["Tracking ID", "Category", "Summary", "Address", "Status", "Urgency", "Department", "Created At"];
    const rows = filtered.map((c) => [
      c.trackingId,
      `"${c.category}"`,
      `"${c.summary.replace(/"/g, '""')}"`,
      `"${c.address.replace(/"/g, '""')}"`,
      c.status,
      c.urgency,
      `"${c.department?.name || 'WASA'}"`,
      c.createdAt,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `civicfix_complaints_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Municipal Complaints Master Ledger
          </h1>
          <p className="text-xs text-slate-500">
            Complete city-wide grievance ledger with export capabilities
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold py-2.5 px-4 rounded-xl shadow-2xs transition-all flex items-center gap-2 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-[#0D7377]" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search by ticket ID, category, street..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500 font-medium text-slate-800"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs font-bold px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 outline-none w-full md:w-auto"
        >
          <option value="ALL">All Statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="ASSIGNED">Assigned</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="RESOLVED">Resolved (Awaiting Confirmation)</option>
          <option value="CONFIRMED">Closed</option>
          <option value="REOPENED">Reopened</option>
        </select>
      </div>

      {/* Table Container (Scrolls Horizontally inside its own container only) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            <span>Loading complaints...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Ticket</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Summary</th>
                  <th className="py-3.5 px-4">Urgency</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Department</th>
                  <th className="py-3.5 px-4">Reported</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filtered.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {c.trackingId}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-teal-800">
                      {c.category}
                    </td>
                    <td className="py-3.5 px-4 max-w-xs truncate font-semibold">
                      {c.summary}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${
                        c.urgency >= 7 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
                      }`}>
                        {c.urgency}/10
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-800">
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {c.department?.name || "WASA"}
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px]">
                      {new Date(c.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href={`/track/${c.trackingId}`}
                        className="text-[#0D7377] font-bold hover:underline"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
