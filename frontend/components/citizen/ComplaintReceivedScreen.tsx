"use client";

import React, { useState, useEffect } from "react";
import { 
  ChevronLeft, 
  Copy, 
  Check, 
  Building2, 
  Volume2, 
  ArrowRight, 
  Sparkles, 
  Users, 
  Clock, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  CheckCircle2, 
  VolumeX, 
  Share2,
  MapPin,
  ShieldCheck
} from "lucide-react";

interface Props {
  onBack?: () => void;
  onNavigateToTrack?: (trackingId?: string) => void;
  trackingId?: string;
  isWideView?: boolean;
  complaintData?: {
    id?: string;
    trackingId?: string;
    category?: string;
    summary?: string;
    description?: string;
    address?: string;
    urgency?: number;
    reasons?: Array<string | { points?: string; title?: string; detail?: string }>;
    departmentName?: string;
    department?: { name: string };
    slaDueAt?: string;
    status?: string;
    assignedWorkerFirstName?: string | null;
  };
}

export default function ComplaintReceivedScreen({
  onBack,
  onNavigateToTrack,
  trackingId: initialTrackingId = "CF-1042",
  isWideView = false,
  complaintData
}: Props) {
  const effectiveTrackingId = complaintData?.trackingId || initialTrackingId;
  const effectiveCategory = complaintData?.category || "General Civic Issue";
  const effectiveUrgency = typeof complaintData?.urgency === "number" ? complaintData.urgency : 5;
  const effectiveDept = complaintData?.departmentName || complaintData?.department?.name || (["Roads", "Potholes", "Streetlights"].includes(effectiveCategory) ? "Traffic & Transport (TEPA)" : "Water and Sanitation (WASA)");
  const effectiveAddress = complaintData?.address || "Street location, Lahore";
  const effectiveReasons = complaintData?.reasons && complaintData.reasons.length > 0
    ? complaintData.reasons
    : [
        { points: `+${effectiveUrgency}`, title: `Base severity evaluated for ${effectiveCategory}` },
        { points: "AI Rules", title: "Municipal risk parameters assessed by CivicFix Triage Engine" }
      ];

  const [copied, setCopied] = useState<boolean>(false);
  const [affectedCount, setAffectedCount] = useState<number>(2);
  const [hasVotedAffected, setHasVotedAffected] = useState<boolean>(false);
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number }>({
    hours: 23,
    minutes: 41,
    seconds: 8
  });
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [animatedScore, setAnimatedScore] = useState<number>(0);
  const [expandedReason, setExpandedReason] = useState<string | null>(null);

  // Animated Urgency Gauge Counter on mount
  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      setAnimatedScore(current);
      if (current >= effectiveUrgency) {
        clearInterval(interval);
      }
    }, 80);
    return () => clearInterval(interval);
  }, [effectiveUrgency]);

  // Live SLA countdown timer
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev.seconds > 0) {
          return { ...prev, seconds: prev.seconds - 1 };
        } else if (prev.minutes > 0) {
          return { ...prev, minutes: 59, seconds: 59 };
        } else if (prev.hours > 0) {
          return { hours: prev.hours - 1, minutes: 59, seconds: 59 };
        }
        return prev;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleCopy = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(effectiveTrackingId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  const handleAffectedVote = () => {
    if (!hasVotedAffected) {
      setAffectedCount(prev => prev + 1);
      setHasVotedAffected(true);
    }
  };

  const handleReadAloud = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      const text = `Complaint received with tracking ID ${effectiveTrackingId}. Urgency score is ${effectiveUrgency} out of 10. Routed to ${effectiveDept}. Being reviewed by Department Officer.`;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    }
  };

  const formatTime = (h: number, m: number, s: number) => {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="w-full mx-auto bg-slate-50 min-h-screen sm:min-h-[640px] flex flex-col justify-between shadow-xl relative font-sans text-slate-800 max-w-[1400px] sm:rounded-3xl border border-slate-200 overflow-hidden">
      {/* Top Header */}
      <header className="px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between border-b border-slate-100 bg-white sticky top-0 z-20">
        <div className="flex items-center space-x-2.5">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1.5 rounded-xl hover:bg-slate-100 text-slate-600 transition-colors"
              title="Back"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div className="w-9 h-9 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-sm ring-2 ring-emerald-100">
            <Check className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight text-slate-900 block leading-tight">
              Complaint Registered
            </span>
            <span className="text-xs text-emerald-700 font-semibold block">
              Dispatched to Department Queue
            </span>
          </div>
        </div>

        <button
          onClick={handleCopy}
          className="text-xs font-bold text-[#0D7377] hover:bg-teal-50 px-3 py-1.5 rounded-xl border border-teal-200 transition-all flex items-center gap-1.5"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? "Copied" : "Copy ID"}</span>
        </button>
      </header>

      {/* Main Content Grid */}
      <div className="flex-1 p-5 sm:p-6 lg:p-8 space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Urgency & Tracking Card */}
          <div className="w-full lg:col-span-6 bg-[#0B1E36] text-white rounded-3xl p-6 sm:p-8 shadow-xl space-y-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center space-x-5 relative z-10">
              {/* Urgency Circular Gauge */}
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-800"
                    strokeWidth="3.8"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-amber-500 transition-all duration-1000 ease-out"
                    strokeDasharray={`${(animatedScore / 10) * 100}, 100`}
                    strokeWidth="3.8"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-white leading-none font-mono">
                    {animatedScore}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                    OF 10
                  </span>
                </div>
              </div>

              {/* Urgency Details */}
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <span className="text-lg font-bold text-white tracking-tight">
                    Urgency Score
                  </span>
                  <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                    effectiveUrgency >= 7 ? "bg-rose-600 text-white" : "bg-amber-600 text-white"
                  }`}>
                    {effectiveUrgency >= 7 ? "URGENT" : "STANDARD"}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 leading-snug">
                  Evaluated transparently via deterministic municipal scoring rules.
                </p>
              </div>
            </div>

            {/* Tracking ID Row */}
            <div className="space-y-3 pt-3 border-t border-slate-800 relative z-10">
              <div className="flex items-center justify-between bg-slate-900/80 p-3 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    TRACKING ID
                  </span>
                  <span className="text-lg font-extrabold text-white tracking-wider font-mono">
                    {effectiveTrackingId}
                  </span>
                </div>
                <button
                  onClick={handleCopy}
                  className="bg-white/10 hover:bg-white/20 active:scale-95 text-white p-2 rounded-xl transition-all flex items-center space-x-1.5 text-xs font-semibold"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-300" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Department & SLA Countdown */}
              <div className="flex items-center justify-between text-xs pt-1">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-teal-900/80 flex items-center justify-center text-teal-300">
                    <Building2 className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-bold text-white block leading-tight">{effectiveDept}</span>
                    <span className="text-[10px] text-slate-400">{effectiveAddress}</span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
                    SLA DEADLINE
                  </span>
                  <div className="flex items-center justify-end space-x-1 font-mono font-bold text-amber-400 text-xs">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-ping mr-1" />
                    <span>{formatTime(timeLeft.hours, timeLeft.minutes, timeLeft.seconds)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Department Routing Status: Plain language, NO fake van / officer! */}
            <div className="bg-slate-900/90 rounded-2xl p-3 border border-slate-800 flex items-center gap-3">
              <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0" />
              <div className="text-xs">
                <span className="text-slate-300">Routing Status: </span>
                <strong className="text-teal-300">
                  {complaintData?.assignedWorkerFirstName 
                    ? `Assigned to worker ${complaintData.assignedWorkerFirstName}`
                    : `Sent to ${effectiveDept}, being reviewed by Department Officer`}
                </strong>
              </div>
            </div>
          </div>

          {/* Right Side: Why This Score Breakdown */}
          <div className="w-full lg:col-span-6 space-y-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  WHY THIS SCORE
                </h3>
                <span className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Info className="w-3 h-3" />
                  <span>Explainable Rules</span>
                </span>
              </div>

              <div className="space-y-2.5">
                {effectiveReasons.map((reason: any, idx) => {
                  const title = typeof reason === "string" ? reason : reason?.title || "";
                  const points = typeof reason === "object" ? reason?.points : null;
                  return (
                    <div 
                      key={idx}
                      className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-start justify-between gap-2.5 text-xs text-slate-700"
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <span className="w-6 h-6 rounded-xl bg-teal-50 text-[#0D7377] font-black text-xs flex items-center justify-center shrink-0 border border-teal-200 mt-0.5">
                          ✓
                        </span>
                        <span className="leading-relaxed font-medium">{title}</span>
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

            {/* Neighborhood Cluster Card */}
            <div className="bg-amber-50/70 border border-amber-200 rounded-3xl p-5 shadow-2xs">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-3">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-900 mb-1">
                    <Users className="w-4 h-4 text-amber-700" />
                    <span>Merged into active neighborhood cluster</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-snug">
                    {affectedCount} other residents near this location reported issues with {effectiveCategory.toLowerCase()}.
                  </p>
                </div>

                <button
                  onClick={handleAffectedVote}
                  disabled={hasVotedAffected}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1 ${
                    hasVotedAffected
                      ? "bg-emerald-600 text-white"
                      : "bg-[#0D7377] hover:bg-[#0A4D54] text-white active:scale-95"
                  }`}
                >
                  {hasVotedAffected ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Counted</span>
                    </>
                  ) : (
                    <span>+1 Affected</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <footer className="bg-white border-t border-slate-200 rounded-t-3xl pt-3 pb-6 px-5 sm:px-6 z-20">
        <div className="flex items-center space-x-3">
          <button
            onClick={handleReadAloud}
            className={`flex-1 py-3.5 px-4 rounded-2xl text-xs font-bold border transition-all flex items-center justify-center space-x-2 ${
              isSpeaking
                ? "bg-teal-50 border-[#0D7377] text-[#0D7377] animate-pulse"
                : "border-slate-300 hover:border-slate-400 bg-white text-slate-700"
            }`}
          >
            {isSpeaking ? (
              <>
                <VolumeX className="w-4 h-4 text-[#0D7377]" />
                <span>Stop Reading</span>
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 text-slate-600" />
                <span>Read Aloud</span>
              </>
            )}
          </button>

          <button
            onClick={() => {
              if (onNavigateToTrack) {
                onNavigateToTrack(effectiveTrackingId);
              }
            }}
            className="flex-1 bg-[#0D7377] hover:bg-[#0A4D54] active:scale-95 text-white font-bold py-3.5 px-4 rounded-2xl text-xs transition-all shadow-md flex items-center justify-center space-x-2"
          >
            <span>Track Complaint</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </footer>
    </div>
  );
}
