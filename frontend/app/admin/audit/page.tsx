"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ShieldAlert, Clock, ArrowRight, Loader2, User, Search } from "lucide-react";

interface AuditEvent {
  id: string;
  type: string;
  actorRole: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
  actor?: { name: string; email: string } | null;
  complaint?: { trackingId: string; summary: string } | null;
}

export default function AdminAuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/audit")
      .then((r) => r.json())
      .then((data) => {
        if (data.events) setEvents(data.events);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const filtered = events.filter((ev) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      ev.type.toLowerCase().includes(q) ||
      (ev.note && ev.note.toLowerCase().includes(q)) ||
      (ev.complaint && ev.complaint.trackingId.toLowerCase().includes(q)) ||
      (ev.actor && ev.actor.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Municipal Governance & State Machine Audit Log
          </h1>
          <p className="text-xs text-slate-500">
            Immutable log of state transitions, worker dispatches, and citizen verification events
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Search events, actors, ticket IDs..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full text-xs pl-10 pr-3 py-2.5 rounded-xl border border-slate-200 outline-none focus:border-teal-500 font-medium text-slate-800"
          />
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            <span>Loading audit trail...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">No audit events found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Timestamp</th>
                  <th className="py-3.5 px-4">Event Type</th>
                  <th className="py-3.5 px-4">Ticket</th>
                  <th className="py-3.5 px-4">Actor</th>
                  <th className="py-3.5 px-4">Role</th>
                  <th className="py-3.5 px-4">Transition & Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                      {new Date(ev.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {ev.type}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-[#0D7377]">
                      {ev.complaint ? (
                        <Link href={`/track/${ev.complaint.trackingId}`} className="hover:underline">
                          {ev.complaint.trackingId}
                        </Link>
                      ) : "—"}
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-800">
                      {ev.actor ? ev.actor.name : "System Engine"}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                        {ev.actorRole}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-sm truncate">
                      {ev.fromStatus && ev.toStatus ? (
                        <span className="font-mono text-[11px] font-bold text-slate-800 mr-2">
                          {ev.fromStatus} &rarr; {ev.toStatus}
                        </span>
                      ) : null}
                      <span>{ev.note || ""}</span>
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
