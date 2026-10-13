"use client";

import React, { useState } from "react";
import { 
  ChevronLeft, 
  Mic, 
  Check, 
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Star,
  Camera,
  MessageSquare,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from "lucide-react";
import BeforeAfterSlider from "./BeforeAfterSlider";

interface Props {
  onBack?: () => void;
  defaultTrackingId?: string;
  isWideView?: boolean;
}

interface ComplaintDetail {
  id: string;
  title: string;
  department: string;
  status: "Pending" | "In progress" | "Resolved" | "Confirmed" | "Reopened";
  step: number; // 1 to 4
  reportedDate: string;
  resolvedDate: string;
  beforeLabel: string;
  afterLabel: string;
  officerNotes: string;
}

export default function TrackComplaintScreen({
  onBack,
  defaultTrackingId = "CF-1042",
  isWideView = false
}: Props) {
  const [trackingId, setTrackingId] = useState<string>(defaultTrackingId);
  const [confirmedStatus, setConfirmedStatus] = useState<"pending" | "fixed" | "reopened">("pending");
  const [rating, setRating] = useState<number>(5);
  const [reopenReason, setReopenReason] = useState<string>("Water still leaking");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);

  // Sample database of complaints that citizens can search / track
  const sampleComplaints: Record<string, ComplaintDetail> = {
    "CF-1042": {
      id: "CF-1042",
      title: "Sewage overflow on Street 4",
      department: "Water and Sanitation (WASA)",
      status: "Resolved",
      step: 3,
      reportedDate: "Oct 10, 2026 • 09:30 AM",
      resolvedDate: "Oct 11, 2026 • 04:15 PM",
      beforeLabel: "Before: Clogged drain",
      afterLabel: "After: Cleaned pipe",
      officerNotes: "Submersible pump deployed, main suction completed, chlorine spray applied."
    },
    "CF-1001": {
      id: "CF-1001",
      title: "Large pothole near Care Hospital",
      department: "Road Maintenance (TEPA)",
      status: "In progress",
      step: 2,
      reportedDate: "Oct 11, 2026 • 02:15 PM",
      resolvedDate: "Estimated: Today 08:00 PM",
      beforeLabel: "Before: Deep pothole",
      afterLabel: "Target: Asphalt patch",
      officerNotes: "Asphalt dispatch scheduled. Crew en route to Hospital road."
    },
    "CF-0899": {
      id: "CF-0899",
      title: "Street lamp 14 flickering & broken",
      department: "Electricity & Lights (LESCO)",
      status: "Confirmed",
      step: 4,
      reportedDate: "Oct 08, 2026 • 07:00 PM",
      resolvedDate: "Oct 09, 2026 • 11:30 AM",
      beforeLabel: "Before: Broken bulb",
      afterLabel: "After: LED fixture replaced",
      officerNotes: "Installed 45W energy-efficient LED street fixture. Tested working."
    }
  };

  const currentComplaint = sampleComplaints[trackingId.toUpperCase()] || {
    id: trackingId.toUpperCase(),
    title: "Registered Civic Complaint",
    department: "Municipal Services",
    status: "Resolved" as const,
    step: 3,
    reportedDate: "Recent submission",
    resolvedDate: "Under review",
    beforeLabel: "Before repair",
    afterLabel: "After repair",
    officerNotes: "Department field crew verified location."
  };

  const handleFixConfirmation = (fixed: boolean) => {
    if (fixed) {
      setConfirmedStatus("fixed");
    } else {
      setConfirmedStatus("reopened");
    }
  };

  const currentStep = confirmedStatus === "fixed" ? 4 : confirmedStatus === "reopened" ? 2 : currentComplaint.step;

  return (
    <div className="w-full mx-auto bg-[#F8FAFC] min-h-screen sm:min-h-[640px] md:min-h-[720px] flex flex-col justify-between shadow-xl relative font-sans text-slate-800 transition-all duration-300 max-w-full lg:max-w-6xl sm:rounded-3xl border border-slate-200 overflow-hidden">
      {/* Top Header */}
      <header className="px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100 bg-white/80 backdrop-blur-md sticky top-0 z-20">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="w-9 h-9 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            title="Back"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="ml-3">
            <h1 className="text-xl font-bold text-slate-900 leading-tight">
              Track complaint
            </h1>
            <span className="text-[10px] text-teal-700 font-bold uppercase tracking-wider block">
              Live Audit Trail
            </span>
          </div>
        </div>

        {/* Status Pill */}
        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
          confirmedStatus === "fixed"
            ? "bg-emerald-100 text-emerald-800"
            : confirmedStatus === "reopened"
            ? "bg-rose-100 text-rose-800"
            : "bg-[#D1F2EE] text-[#0A6B6D]"
        }`}>
          {confirmedStatus === "fixed" ? "Confirmed" : confirmedStatus === "reopened" ? "Reopened" : currentComplaint.status}
        </span>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 px-4 sm:px-6 py-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-12 lg:pb-8">
        {/* Left Column (Search, Stepper, Status, Timeline) */}
        <div className="w-full lg:col-span-6 space-y-4">
          {/* Tracking ID Search Bar */}
          <div className="space-y-2">
            <div className="bg-white border border-slate-200 rounded-2xl px-3.5 py-1.5 flex items-center justify-between shadow-sm focus-within:ring-2 focus-within:ring-[#0D5C63]">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value.toUpperCase())}
                placeholder="Enter tracking ID..."
                className="text-base font-bold text-slate-900 tracking-wider font-mono outline-none bg-transparent flex-1"
              />
              <span className="text-[10px] text-slate-400 font-bold uppercase bg-slate-100 px-2 py-0.5 rounded-md">
                Live
              </span>
            </div>

            {/* Quick complaint switcher chips */}
            <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
              {Object.keys(sampleComplaints).map((id) => (
                <button
                  key={id}
                  onClick={() => {
                    setTrackingId(id);
                    setConfirmedStatus("pending");
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono transition-all shrink-0 ${
                    trackingId.toUpperCase() === id
                      ? "bg-[#0D5C63] text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {id}
                </button>
              ))}
            </div>
          </div>

          {/* Complaint Title & Subtitle */}
          <div className="bg-white rounded-3xl p-4 border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 tracking-tight leading-snug">
              {currentComplaint.title}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Department: <span className="font-semibold text-slate-700">{currentComplaint.department}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Reported on {currentComplaint.reportedDate}
            </p>
          </div>

          {/* Multi-step Horizontal Stepper */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm py-5">
            <div className="flex items-center justify-between relative px-2">
              {/* Connecting Line */}
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0">
                <div 
                  className="h-full bg-[#0D5C63] transition-all duration-500"
                  style={{
                    width: currentStep === 1 ? "10%" : currentStep === 2 ? "40%" : currentStep === 3 ? "72%" : "100%"
                  }}
                />
              </div>

              {/* Step 1: Received / Pending */}
              <div className="flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm text-white ${
                  currentStep >= 1 ? "bg-[#0D5C63]" : "bg-slate-300"
                }`}>
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2">
                  Received
                </span>
              </div>

              {/* Step 2: In progress */}
              <div className="flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm text-white ${
                  currentStep >= 2 ? "bg-[#0D5C63]" : "bg-slate-300"
                }`}>
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2">
                  In progress
                </span>
              </div>

              {/* Step 3: Resolved */}
              <div className="flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shadow-sm text-white ${
                  currentStep >= 3 ? "bg-[#0D5C63]" : "bg-slate-300"
                }`}>
                  <Check className="w-4 h-4 stroke-[3]" />
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-2">
                  Resolved
                </span>
              </div>

              {/* Step 4: Confirmed */}
              <div className="flex flex-col items-center relative z-10">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all ${
                  currentStep >= 4
                    ? "bg-[#0D5C63] border-[#0D5C63] text-white shadow-sm"
                    : "border-slate-300 bg-white text-transparent"
                }`}>
                  {currentStep >= 4 && <Check className="w-4 h-4 stroke-[3]" />}
                </div>
                <span className={`text-[11px] font-semibold mt-2 ${
                  currentStep >= 4 ? "text-slate-800 font-bold" : "text-slate-400"
                }`}>
                  Confirmed
                </span>
              </div>
            </div>
          </div>

          {/* TIMELINE Audit Trail Section */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-4">
              AUDIT TIMELINE
            </h3>

            <div className="space-y-5 relative pl-6 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
              {/* Timeline Item 1 */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#0D5C63] ring-4 ring-white" />
                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                  Resolved & Evidence Uploaded
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {currentComplaint.officerNotes}
                </p>
                <span className="text-[10px] text-teal-700 font-mono mt-1 block">
                  {currentComplaint.resolvedDate}
                </span>
              </div>

              {/* Timeline Item 2 */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#0D5C63] ring-4 ring-white" />
                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                  Dispatched to Field Crew
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Assigned to Unit 4-B with high priority SLA.
                </p>
              </div>

              {/* Timeline Item 3 */}
              <div className="relative">
                <div className="absolute -left-6 top-1 w-3.5 h-3.5 rounded-full bg-[#0D5C63] ring-4 ring-white" />
                <h4 className="text-sm font-bold text-slate-900 leading-tight">
                  Received & Rules Scored (8/10)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Voice intake processed and categorized.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (Before/After Slider & Confirmation Card) */}
        <div className="w-full lg:col-span-6 space-y-4">
          {/* BEFORE AND AFTER Slider Section */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              BEFORE AND AFTER EVIDENCE
            </h3>
            <BeforeAfterSlider 
              beforeTitle={currentComplaint.beforeLabel}
              afterTitle={currentComplaint.afterLabel}
            />
          </div>

          {/* Confirmation Action Card (Dark Navy) */}
          <div className="bg-[#0B1E36] text-white p-5 rounded-3xl shadow-xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-400" />
              <span>Was the issue fixed?</span>
            </h3>

            {confirmedStatus === "pending" ? (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Please verify if the municipal team completed the work properly at your location.
                </p>
                <div className="flex items-center space-x-3 pt-1">
                  <button
                    onClick={() => handleFixConfirmation(true)}
                    className="flex-1 bg-[#0D7377] hover:bg-[#0F8A8F] active:scale-95 text-white font-bold py-3.5 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Yes, fixed</span>
                  </button>
                  <button
                    onClick={() => handleFixConfirmation(false)}
                    className="flex-1 border border-slate-500 hover:border-white text-white font-bold py-3.5 px-4 rounded-2xl text-xs transition-all hover:bg-white/10 active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>No, not fixed</span>
                  </button>
                </div>
              </div>
            ) : confirmedStatus === "fixed" ? (
              <div className="space-y-3 bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-4">
                <div className="flex items-center space-x-2 text-emerald-400 font-bold text-sm">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Thank you for verifying!</span>
                </div>
                <p className="text-xs text-emerald-200">
                  Rate the quality of the department work:
                </p>
                {/* 5 Star Rating */}
                <div className="flex items-center space-x-2 pt-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      onClick={() => setRating(s)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star className={`w-6 h-6 ${s <= rating ? "text-amber-400 fill-amber-400" : "text-slate-600"}`} />
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setFeedbackSubmitted(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm"
                >
                  {feedbackSubmitted ? "✓ Rating Saved" : "Submit Rating"}
                </button>
              </div>
            ) : (
              <div className="space-y-3 bg-rose-950/60 border border-rose-500/50 rounded-2xl p-4">
                <div className="flex items-center space-x-2 text-rose-400 font-bold text-sm">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Issue marked as Reopened</span>
                </div>
                <p className="text-xs text-rose-200">
                  Select why the issue is still unresolved:
                </p>
                <select
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none"
                >
                  <option value="Water still leaking">Water / Sewage still overflowing</option>
                  <option value="Incomplete repair">Incomplete repair work left</option>
                  <option value="Debris left behind">Debris left on street</option>
                  <option value="Problem returned">Problem returned after rain</option>
                </select>
                <button
                  onClick={() => alert("Reopen ticket dispatched to supervisor queue.")}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm w-full"
                >
                  Send to Department Supervisor
                </button>
              </div>
            )}
          </div>

          {/* Desktop Only: Assigned Field Officer & Quality Guarantee Seal */}
          <div className="hidden lg:block bg-white rounded-3xl p-4 border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  DISPATCHED FIELD OFFICER
                </span>
                <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold px-2 py-0.5 rounded-full">
                  GPS Verified On-Site
                </span>
              </div>
              <div className="flex items-center space-x-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-[#0D5C63] text-white flex items-center justify-center font-bold text-sm shrink-0">
                  TM
                </div>
                <div className="flex-1">
                  <div className="text-xs font-bold text-slate-900">Officer Tariq Mehmood</div>
                  <div className="text-[10px] text-slate-500">Badge #WASA-409 • Rapid Response Unit 4</div>
                  <div className="text-[10px] text-teal-700 font-semibold mt-0.5">Resolved with Submersible Dewatering Equipment</div>
                </div>
              </div>
              <div className="bg-amber-50/70 border border-amber-200/70 rounded-2xl p-2.5 flex items-center gap-2 text-[11px] text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
                <span><strong>CivicFix Quality Assurance:</strong> 30-day rework warranty. If problem resurfaces, reopening triggers automatic level-2 escalation.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}
