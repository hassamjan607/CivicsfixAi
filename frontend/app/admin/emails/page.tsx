"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, RefreshCw, Send, CheckCircle2, AlertCircle, Loader2, Search } from "lucide-react";

interface EmailLogItem {
  id: string;
  to: string;
  subject: string;
  template: string;
  complaintId?: string | null;
  status: "SENT" | "FAILED" | "QUEUED";
  error?: string | null;
  attempts: number;
  sentAt?: string | null;
  createdAt: string;
}

export default function AdminEmailsPage() {
  const [emails, setEmails] = useState<EmailLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const fetchEmails = () => {
    fetch("/api/admin/emails")
      .then((r) => r.json())
      .then((data) => {
        if (data.emails) setEmails(data.emails);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchEmails();
  }, []);

  const handleResend = async (id: string) => {
    setResendingId(id);
    try {
      const res = await fetch(`/api/admin/emails/${id}/resend`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Resend failed");
      else fetchEmails();
    } catch {
      alert("Resend request error");
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">
            Background Automated Email Outbox
          </h1>
          <p className="text-xs text-slate-500">
            Audit logs for notifications, verification links, and dispatch alerts
          </p>
        </div>

        <button
          onClick={fetchEmails}
          className="bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-xs font-bold py-2 px-3.5 rounded-xl shadow-2xs transition-all flex items-center gap-1.5 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#0D7377]" />
          <span>Refresh Outbox</span>
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400 text-xs">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-teal-600 mb-2" />
            <span>Loading email outbox...</span>
          </div>
        ) : emails.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs">No email logs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-3.5 px-4">Recipient</th>
                  <th className="py-3.5 px-4">Subject</th>
                  <th className="py-3.5 px-4">Template</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4">Sent Time</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {emails.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {m.to}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800 max-w-xs truncate">
                      {m.subject}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                      {m.template}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                        m.status === "SENT"
                          ? "bg-emerald-100 text-emerald-800"
                          : m.status === "FAILED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {m.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 text-[11px] whitespace-nowrap">
                      {m.sentAt ? new Date(m.sentAt).toLocaleString() : "Pending"}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleResend(m.id)}
                        disabled={resendingId === m.id}
                        className="text-[#0D7377] font-bold hover:underline inline-flex items-center gap-1 disabled:opacity-40"
                      >
                        {resendingId === m.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Send className="w-3 h-3" />
                        )}
                        <span>Resend</span>
                      </button>
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
