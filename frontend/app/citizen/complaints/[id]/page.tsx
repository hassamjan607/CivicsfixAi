"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Building2, 
  Clock, 
  MapPin, 
  Sparkles, 
  Star, 
  CheckCircle2, 
  RotateCcw, 
  Loader2, 
  AlertTriangle,
  Camera,
  Calendar
} from "lucide-react";
import BeforeAfterSlider from "@/components/citizen/BeforeAfterSlider";

interface ComplaintDetail {
  id: string;
  trackingId: string;
  category: string;
  summary: string;
  description: string;
  address: string;
  status: "SUBMITTED" | "ASSIGNED" | "IN_PROGRESS" | "RESOLVED" | "CONFIRMED" | "REOPENED";
  urgency: number;
  reasons: string[];
  department?: { name: string; code: string };
  assignedWorker?: { name: string; role: string } | null;
  slaDueAt: string;
  createdAt: string;
  beforePhotoUrls: string[];
  proofs: { afterPhotoUrl: string; note?: string; createdAt: string }[];
  events: { type: string; actorRole: string; note?: string; createdAt: string }[];
}

export default function CitizenComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialogs
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReopenModal, setShowReopenModal] = useState(false);
  const [rating, setRating] = useState(5);
  const [reopenReason, setReopenReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const fetchComplaint = () => {
    setLoading(true);
    fetch(`/api/complaints/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Complaint not found or access denied.");
        return res.json();
      })
      .then((data) => {
        setComplaint(data.complaint);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load complaint");
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchComplaint();
  }, [id]);

  const handleConfirm = async () => {
    if (!complaint) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, note: "Citizen confirmed via portal" }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Confirmation failed.");
      } else {
        setActionSuccess("Thank you! Complaint marked as resolved & closed.");
        setShowConfirmModal(false);
        fetchComplaint();
      }
    } catch {
      alert("Request failed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!complaint || !reopenReason.trim()) {
      alert("Please provide a reason why the issue was not resolved.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reopenReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Reopen failed.");
      } else {
        setActionSuccess("Complaint reopened and returned to department officer queue.");
        setShowReopenModal(false);
        fetchComplaint();
      }
    } catch {
      alert("Request failed.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#0D7377] mb-3" />
        <span>Loading complaint details...</span>
      </div>
    );
  }

  if (error || !complaint) {
    return (
      <div className="bg-white rounded-3xl p-8 border border-slate-200 shadow-xl max-w-md mx-auto text-center space-y-4 my-8">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-black text-slate-900">Unable to View Complaint</h2>
        <p className="text-xs text-slate-600">{error || "Complaint not found."}</p>
        <Link
          href="/citizen/complaints"
          className="inline-block bg-[#0D7377] text-white text-xs font-bold py-2.5 px-5 rounded-xl hover:bg-[#095256] transition-all"
        >
          Back to Complaints
        </Link>
      </div>
    );
  }

  const steps = [
    { key: "SUBMITTED", label: "Reported" },
    { key: "ASSIGNED", label: "Assigned" },
    { key: "IN_PROGRESS", label: "In Progress" },
    { key: "RESOLVED", label: "Fixed (Proof Attached)" },
    { key: "CONFIRMED", label: "Closed" },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case "SUBMITTED": return 0;
      case "ASSIGNED": return 1;
      case "IN_PROGRESS": return 2;
      case "RESOLVED": return 3;
      case "CONFIRMED": return 4;
      case "REOPENED": return 1;
      default: return 0;
    }
  };

  const currentStepIdx = getStepIndex(complaint.status);
  const beforePhoto = complaint.beforePhotoUrls?.[0] || null;
  const afterPhoto = complaint.proofs?.[0]?.afterPhotoUrl || null;
  const workerFirstName = complaint.assignedWorker ? complaint.assignedWorker.name.split(" ")[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/citizen/complaints"
          className="text-xs font-bold text-[#0D7377] hover:underline flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Complaints List</span>
        </Link>

        <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-3 py-1 rounded-full">
          {complaint.trackingId}
        </span>
      </div>

      {actionSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Action Required Banner when status is RESOLVED */}
      {complaint.status === "RESOLVED" && (
        <div className="bg-gradient-to-r from-amber-500 via-teal-600 to-[#0D7377] p-1 rounded-3xl shadow-lg">
          <div className="bg-white rounded-[22px] p-5 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <div className="inline-flex items-center gap-1.5 bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full">
                <span>Action Required</span>
              </div>
              <h3 className="text-lg font-black text-slate-900">
                Was the issue fixed to your satisfaction?
              </h3>
              <p className="text-xs text-slate-500">
                Review the Before & After photos below and confirm or request reopening.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => setShowConfirmModal(true)}
                className="bg-[#0D7377] hover:bg-[#095256] active:scale-95 text-white text-xs font-extrabold py-3 px-5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4 text-teal-300" />
                <span>Yes, Confirm Fix</span>
              </button>

              <button
                onClick={() => setShowReopenModal(true)}
                className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 active:scale-95 text-xs font-bold py-3 px-4 rounded-xl transition-all flex items-center gap-1.5"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Not Fixed (Reopen)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Overview Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="bg-teal-50 text-[#0D7377] border border-teal-200 text-xs font-bold px-3 py-1 rounded-full">
                {complaint.category}
              </span>
              <span className="text-xs font-bold text-slate-500">
                {complaint.status}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">
              {complaint.summary}
            </h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{complaint.address}</span>
            </p>
          </div>

          <div className="sm:text-right shrink-0">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1">
              Department
            </span>
            <div className="text-sm font-bold text-slate-900 flex sm:justify-end items-center gap-1.5">
              <Building2 className="w-4 h-4 text-[#0D7377]" />
              <span>{complaint.department?.name || "Municipal Agency"}</span>
            </div>
            {workerFirstName && (
              <div className="text-xs text-slate-500 mt-0.5">
                Assigned Worker: <strong className="text-slate-800">{workerFirstName}</strong> ({complaint.assignedWorker?.role})
              </div>
            )}
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="space-y-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
            Resolution Stepper
          </span>
          <div className="grid grid-cols-5 gap-2 text-center">
            {steps.map((st, i) => {
              const isPassed = i <= currentStepIdx;
              const isCurrent = i === currentStepIdx;
              return (
                <div key={st.key} className="space-y-1.5">
                  <div
                    className={`h-2.5 rounded-full transition-all ${
                      isPassed ? "bg-[#0D7377]" : "bg-slate-200"
                    }`}
                  />
                  <span
                    className={`text-[10px] block leading-tight font-bold ${
                      isCurrent ? "text-[#0D7377]" : isPassed ? "text-slate-800" : "text-slate-400"
                    }`}
                  >
                    {st.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2-Column Section: Before/After Slider + Urgency Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#0D7377]" />
              <span>Before & After Photographic Proof</span>
            </h3>
            <span className="text-xs text-slate-400">
              {afterPhoto ? "Verified field completion" : "Pending worker completion photo"}
            </span>
          </div>

          <BeforeAfterSlider
            beforeTitle="Before (Reported)"
            afterTitle="After (Repaired)"
            beforePhotoUrl={beforePhoto}
            afterPhotoUrl={afterPhoto}
          />

          {complaint.proofs?.[0]?.note && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-600">
              <strong className="text-slate-800">Field Worker Note:</strong> {complaint.proofs[0].note}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>Explainable Urgency</span>
              </h3>
              <div className="bg-slate-900 text-white font-mono font-bold text-xs px-2.5 py-1 rounded-full">
                {complaint.urgency} / 10
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Rule Reasons
              </span>
              <div className="space-y-2">
                {complaint.reasons?.map((reason: any, idx) => {
                  const title = typeof reason === "string" ? reason : reason?.title || "";
                  const points = typeof reason === "object" ? reason?.points : null;
                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 flex items-start justify-between gap-2"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="w-4 h-4 rounded-full bg-teal-100 text-[#0D7377] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                          ✓
                        </span>
                        <span className="leading-snug">{title}</span>
                      </div>
                      {points && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 shrink-0 font-mono">
                          {points}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-teal-50 border border-teal-100 space-y-1">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-800 block">
              SLA Resolution Deadline
            </span>
            <div className="flex items-center justify-between text-xs font-bold text-[#0D7377]">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>Due:</span>
              </div>
              <span className="font-mono">
                {new Date(complaint.slaDueAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Audit Event Timeline */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900">
          Audit Event Log
        </h3>
        <div className="space-y-3">
          {complaint.events?.map((ev, idx) => (
            <div
              key={idx}
              className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
            >
              <div className="w-6 h-6 rounded-lg bg-[#0B1E36] text-white flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">{ev.type}</span>
                  <span className="text-[10px] text-slate-400">
                    {new Date(ev.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="text-slate-600 mt-0.5">
                  {ev.note || `Action logged by ${ev.actorRole}`}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Confirm Issue Resolution</h3>
            <p className="text-xs text-slate-600">Rate your satisfaction with the repair:</p>
            <div className="flex items-center justify-center gap-2 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`p-2 transition-transform ${
                    star <= rating ? "text-amber-400 scale-110" : "text-slate-300"
                  }`}
                >
                  <Star className="w-7 h-7 fill-current" />
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-xs font-bold text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={actionLoading}
                className="bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Confirm & Close</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-rose-700">Reopen Complaint Ticket</h3>
            <p className="text-xs text-slate-600">
              Please state why the problem was not solved. The officer and admin will be notified.
            </p>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Reason for Reopening</label>
              <textarea
                rows={3}
                required
                value={reopenReason}
                onChange={(e) => setReopenReason(e.target.value)}
                placeholder="e.g. Sewage is still seeping across the pavement..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-rose-500 resize-none font-medium text-slate-800"
              />
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowReopenModal(false)}
                className="text-xs font-bold text-slate-600 px-4 py-2 rounded-xl hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleReopen}
                disabled={actionLoading || !reopenReason.trim()}
                className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Reopen Ticket</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
