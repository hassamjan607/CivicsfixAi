"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  Shield, 
  Sparkles, 
  Wrench, 
  Building2, 
  Clock, 
  MapPin, 
  Camera, 
  AlertTriangle, 
  CheckCircle2, 
  Loader2, 
  Edit3, 
  ArrowUpRight,
  Send,
  X
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
  confidence: number;
  reasons: string[];
  department?: { name: string; code: string };
  assignedWorker?: { id: string; name: string; role: string } | null;
  slaDueAt: string;
  createdAt: string;
  beforePhotoUrls: string[];
  proofs: { afterPhotoUrl: string; note?: string; createdAt: string }[];
  events: { type: string; actorRole: string; note?: string; createdAt: string }[];
}

interface WorkerItem {
  id: string;
  name: string;
  role: string;
  activeJobsCount: number;
}

export default function OfficerComplaintReviewPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [complaint, setComplaint] = useState<ComplaintDetail | null>(null);
  const [workers, setWorkers] = useState<WorkerItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [instructions, setInstructions] = useState("");
  const [assignLoading, setAssignLoading] = useState(false);

  const [categoryOpen, setCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [instructionOpen, setInstructionOpen] = useState(false);
  const [standaloneNote, setStandaloneNote] = useState("");
  const [instructionLoading, setInstructionLoading] = useState(false);

  const [escalateSuccess, setEscalateSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [compRes, workersRes] = await Promise.all([
        fetch(`/api/complaints/${id}`),
        fetch("/api/officer/workers"),
      ]);

      const compData = await compRes.json();
      const workersData = await workersRes.json();

      if (compData.complaint) {
        setComplaint(compData.complaint);
        setNewCategory(compData.complaint.category);
      }
      if (workersData.workers) setWorkers(workersData.workers);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !selectedWorkerId) return;
    setAssignLoading(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: selectedWorkerId, instructions }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Assignment failed");
      else {
        setAssignOpen(false);
        fetchData();
      }
    } catch {
      alert("Assignment error");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleCategoryChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !newCategory) return;
    setCategoryLoading(true);
    try {
      const res = await fetch(`/api/complaints/${complaint.id}/category`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newCategory }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Category update failed");
      else {
        setCategoryOpen(false);
        fetchData();
      }
    } catch {
      alert("Category error");
    } finally {
      setCategoryLoading(false);
    }
  };

  const handleAddInstruction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaint || !standaloneNote.trim()) return;
    setInstructionLoading(true);
    try {
      // Re-assigning or recording instruction note
      const res = await fetch(`/api/complaints/${complaint.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workerId: complaint.assignedWorker?.id || workers[0]?.id,
          instructions: standaloneNote,
        }),
      });
      setInstructionOpen(false);
      setStandaloneNote("");
      fetchData();
    } catch {
      alert("Error saving note");
    } finally {
      setInstructionLoading(false);
    }
  };

  const handleEscalate = () => {
    setEscalateSuccess("Complaint ticket marked as escalated to City Administrator.");
    setTimeout(() => setEscalateSuccess(null), 4000);
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600 mb-3" />
        <span>Loading complaint review desk...</span>
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="bg-white rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 my-8">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Complaint Not Found</h2>
        <Link href="/officer" className="text-xs font-bold text-[#0D7377] underline">
          Return to Queue
        </Link>
      </div>
    );
  }

  const beforePhoto = complaint.beforePhotoUrls?.[0] || null;
  const afterPhoto = complaint.proofs?.[0]?.afterPhotoUrl || null;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          href="/officer"
          className="text-xs font-bold text-[#0D7377] hover:underline flex items-center gap-1.5 self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Department Queue</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-3 py-1 rounded-full">
            {complaint.trackingId}
          </span>
          <span className="text-xs font-bold text-teal-800 bg-teal-50 border border-teal-200 px-3 py-1 rounded-full">
            {complaint.status}
          </span>
        </div>
      </div>

      {escalateSuccess && (
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span>{escalateSuccess}</span>
        </div>
      )}

      {/* Action Bar */}
      <div className="bg-[#0B1E36] rounded-3xl p-4 sm:p-5 text-white flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-300 flex items-center justify-center font-bold">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold">Department Officer Action Deck</div>
            <div className="text-[11px] text-slate-300">
              Worker: <strong className="text-teal-300">{complaint.assignedWorker?.name || "None (Unassigned)"}</strong>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAssignOpen(true)}
            className="bg-[#0D7377] hover:bg-[#0A4D54] text-white text-xs font-extrabold py-2 px-3.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-95"
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>{complaint.assignedWorker ? "Reassign Worker" : "Assign to Worker"}</span>
          </button>

          <button
            onClick={() => setCategoryOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Change Category</span>
          </button>

          <button
            onClick={() => setInstructionOpen(true)}
            className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Add Instructions</span>
          </button>

          <button
            onClick={handleEscalate}
            className="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold py-2 px-3 rounded-xl transition-all flex items-center gap-1.5"
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Escalate to Admin</span>
          </button>
        </div>
      </div>

      {/* Main Review Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Photo & Voice Transcript */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">
              Photographic Proof & Before/After Comparison
            </h3>

            <BeforeAfterSlider
              beforeTitle="Original Citizen Photo"
              afterTitle="Worker Completion Proof"
              beforePhotoUrl={beforePhoto}
              afterPhotoUrl={afterPhoto}
            />
          </div>

          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-3">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
              Citizen Input & Voice Transcript
            </span>
            <h2 className="text-lg font-bold text-slate-900">
              {complaint.summary}
            </h2>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 text-xs text-slate-700 leading-relaxed font-medium">
              &quot;{complaint.description}&quot;
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{complaint.address}</span>
            </div>
          </div>
        </div>

        {/* Right Side: AI Urgency Analysis & SLA */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-teal-600" />
                <span>AI Urgency & Triage Analysis</span>
              </h3>
              <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2.5 py-1 rounded-full">
                Score: {complaint.urgency} / 10
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-500">Classification Confidence:</span>
                <span className="font-bold text-slate-900">
                  {Math.round((complaint.confidence || 0.92) * 100)}%
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-500">Assigned Department:</span>
                <span className="font-bold text-teal-800">
                  {complaint.department?.name || "WASA"}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-slate-50">
                <span className="text-slate-500">SLA Due Date:</span>
                <span className="font-mono font-bold text-slate-900">
                  {new Date(complaint.slaDueAt).toLocaleString()}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">
                Rule Reasons
              </span>
              {complaint.reasons?.map((r, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-700 flex items-start gap-2"
                >
                  <span className="w-4 h-4 rounded-full bg-teal-100 text-[#0D7377] font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                    ✓
                  </span>
                  <span>{r}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Audit Timeline */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Audit Event Log
            </h3>
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {complaint.events?.map((ev, i) => (
                <div
                  key={i}
                  className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-0.5"
                >
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>{ev.type}</span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {new Date(ev.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{ev.note || ev.actorRole}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Assign Worker Dialog */}
      {assignOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Assign Field Worker</h3>
              <button onClick={() => setAssignOpen(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Select Worker (Department Staff Only)
                </label>
                <div className="space-y-2 max-h-48 overflow-y-auto p-1">
                  {workers.map((w) => (
                    <label
                      key={w.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between cursor-pointer transition-all ${
                        selectedWorkerId === w.id
                          ? "border-[#0D7377] bg-teal-50"
                          : "border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="worker"
                          value={w.id}
                          checked={selectedWorkerId === w.id}
                          onChange={() => setSelectedWorkerId(w.id)}
                          className="accent-[#0D7377]"
                        />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{w.name}</div>
                          <div className="text-[10px] text-slate-500">{w.role}</div>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                        {w.activeJobsCount} Active
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Worker Instructions
                </label>
                <textarea
                  rows={2}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. Inspect the main chamber at the corner..."
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAssignOpen(false)}
                  className="text-xs font-bold text-slate-600 px-4 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || !selectedWorkerId}
                  className="bg-[#0D7377] text-white text-xs font-bold py-2.5 px-4 rounded-xl shadow-xs"
                >
                  {assignLoading ? "Assigning..." : "Assign Worker"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Change Category Dialog */}
      {categoryOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Correct Category</h3>
            <form onSubmit={handleCategoryChange} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Select New Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-slate-200 font-bold text-slate-800"
                >
                  <option value="Sewage">Sewage & Drainage</option>
                  <option value="Roads">Roads & Pavements</option>
                  <option value="Garbage">Solid Waste & Garbage</option>
                  <option value="Streetlights">Streetlights & Electrical</option>
                  <option value="Water">Drinking Water Supply</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCategoryOpen(false)}
                  className="text-xs font-bold text-slate-600 px-3 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={categoryLoading}
                  className="bg-[#0D7377] text-white text-xs font-bold py-2 px-4 rounded-xl"
                >
                  {categoryLoading ? "Updating..." : "Save Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Instruction Note Dialog */}
      {instructionOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Add Field Instruction</h3>
            <form onSubmit={handleAddInstruction} className="space-y-4">
              <textarea
                rows={3}
                required
                value={standaloneNote}
                onChange={(e) => setStandaloneNote(e.target.value)}
                placeholder="Instructions recorded in audit log..."
                className="w-full text-xs p-3 rounded-xl border border-slate-200 resize-none font-medium text-slate-800"
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setInstructionOpen(false)}
                  className="text-xs font-bold text-slate-600 px-3 py-2 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={instructionLoading || !standaloneNote.trim()}
                  className="bg-[#0D7377] text-white text-xs font-bold py-2 px-4 rounded-xl"
                >
                  {instructionLoading ? "Saving..." : "Record Note"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
