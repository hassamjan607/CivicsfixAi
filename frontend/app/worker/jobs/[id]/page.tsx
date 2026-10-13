"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { 
  ArrowLeft, 
  MapPin, 
  Navigation, 
  Camera, 
  Mic, 
  CheckCircle2, 
  Clock, 
  Play, 
  Check, 
  Loader2, 
  AlertTriangle,
  Upload,
  Plus,
  X
} from "lucide-react";

interface JobDetail {
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
  beforePhotoUrls: string[];
  proofs: { afterPhotoUrl: string; note?: string; materials?: string }[];
}

export default function WorkerJobExecutionPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);

  // Field Completion Form
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [notes, setNotes] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [selectedMaterials, setSelectedMaterials] = useState<string[]>([]);
  const [submittingResolve, setSubmittingResolve] = useState(false);
  const [startingJob, setStartingJob] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchJob = () => {
    setLoading(true);
    fetch(`/api/complaints/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.complaint) {
          setJob(data.complaint);
          if (data.complaint.proofs?.[0]?.afterPhotoUrl) {
            setAfterPhotoUrl(data.complaint.proofs[0].afterPhotoUrl);
          }
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchJob();
  }, [id]);

  const handleStartJob = async () => {
    if (!job) return;
    setStartingJob(true);
    try {
      const res = await fetch(`/api/complaints/${job.id}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Failed to start job");
      else fetchJob();
    } catch {
      alert("Error starting job");
    } finally {
      setStartingJob(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setAfterPhotoUrl(data.url);
      } else {
        // Fallback object URL if upload fails in demo mode
        const previewUrl = URL.createObjectURL(file);
        setAfterPhotoUrl(previewUrl);
      }
    } catch {
      const previewUrl = URL.createObjectURL(file);
      setAfterPhotoUrl(previewUrl);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleVoiceDictation = () => {
    if (typeof window === "undefined") return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please type the note.");
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-US";

      rec.onstart = () => setIsListening(true);
      rec.onend = () => setIsListening(false);
      rec.onerror = () => setIsListening(false);
      rec.onresult = (ev: any) => {
        const text = ev.results[0][0].transcript;
        setNotes((prev) => (prev ? `${prev} ${text}` : text));
      };

      rec.start();
    } catch {
      setIsListening(false);
    }
  };

  const toggleMaterial = (mat: string) => {
    if (selectedMaterials.includes(mat)) {
      setSelectedMaterials(selectedMaterials.filter((m) => m !== mat));
    } else {
      setSelectedMaterials([...selectedMaterials, mat]);
    }
  };

  const handleMarkResolved = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job || !afterPhotoUrl) {
      alert("An 'After' photo is strictly required before marking the issue resolved.");
      return;
    }

    setSubmittingResolve(true);
    try {
      const res = await fetch(`/api/complaints/${job.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          afterPhotoUrl,
          note: notes || "Work completed and certified by field crew.",
          materials: selectedMaterials.join(", "),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to mark as resolved");
      } else {
        alert("Success! Work order resolved. Citizen and Officer have been notified.");
        router.push("/worker");
      }
    } catch {
      alert("Request failed. Please retry.");
    } finally {
      setSubmittingResolve(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-xs">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-600 mb-2" />
        <span>Loading work order...</span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="bg-white rounded-3xl p-8 max-w-md mx-auto text-center space-y-4 my-8">
        <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
        <h2 className="text-base font-bold text-slate-900">Job Not Found</h2>
        <Link href="/worker" className="text-xs font-bold text-amber-700 underline">
          Back to Jobs
        </Link>
      </div>
    );
  }

  const materialsList = [
    "Suction Pump",
    "High-Pressure Jet",
    "Chlorine Decontaminant",
    "Cold Asphalt Patch",
    "Replacement PVC Pipe",
    "Safety Barricades",
    "LED 45W Bulb"
  ];

  return (
    <div className="space-y-5">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <Link
          href="/worker"
          className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Jobs</span>
        </Link>

        <span className="font-mono font-bold text-xs bg-slate-200 text-slate-800 px-3 py-1 rounded-full">
          {job.trackingId}
        </span>
      </div>

      {/* Work Order Card */}
      <div className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-full">
            {job.category}
          </span>
          <span className="text-xs font-mono font-bold text-slate-600">
            SLA: {new Date(job.slaDueAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <h1 className="text-lg font-bold text-slate-900 leading-snug">
          {job.summary}
        </h1>

        <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
          {job.description}
        </p>

        {/* Location & Navigation Link */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="font-medium">{job.address}</span>
          </div>

          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-amber-800 hover:underline flex items-center gap-1"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Open in Maps</span>
          </a>
        </div>

        {/* Before Photo if available */}
        {job.beforePhotoUrls && job.beforePhotoUrls[0] && (
          <div className="pt-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Citizen &apos;Before&apos; Photo
            </span>
            <div className="h-44 rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
              <img
                src={job.beforePhotoUrls[0]}
                alt="Before hazard"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </div>

      {/* Start Job Action if status is ASSIGNED */}
      {job.status === "ASSIGNED" && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 text-center space-y-3">
          <h3 className="text-sm font-bold text-amber-950">
            Ready to Begin Work on Site?
          </h3>
          <p className="text-xs text-amber-800">
            Tap below to record that you have departed / arrived at the location.
          </p>
          <button
            onClick={handleStartJob}
            disabled={startingJob}
            className="bg-amber-600 hover:bg-amber-700 text-white font-extrabold text-xs py-3 px-6 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 mx-auto active:scale-95"
          >
            {startingJob ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
            <span>Start Job (Mark In Progress)</span>
          </button>
        </div>
      )}

      {/* Work Completion Form: MANDATORY After Photo & Notes */}
      {(job.status === "IN_PROGRESS" || job.status === "ASSIGNED") && (
        <form onSubmit={handleMarkResolved} className="bg-white rounded-3xl p-5 sm:p-6 border border-slate-200 shadow-2xs space-y-5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900">
              Complete & Resolve Work Order
            </h2>
            <span className="text-[10px] bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-200">
              *After Photo Required
            </span>
          </div>

          {/* Camera Upload for After Photo */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              1. Capture &apos;After&apos; Photo (Required Proof)
            </label>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment" // Opens rear device camera on mobile phones
              onChange={handleFileUpload}
              className="hidden"
            />

            {afterPhotoUrl ? (
              <div className="relative h-56 rounded-2xl overflow-hidden border-2 border-emerald-500 shadow-md">
                <img
                  src={afterPhotoUrl}
                  alt="After repair proof"
                  className="w-full h-full object-cover"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-xs text-slate-800 text-xs font-bold py-1.5 px-3 rounded-xl shadow-md flex items-center gap-1.5 hover:bg-white"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Retake Photo</span>
                </button>
                <div className="absolute top-3 left-3 bg-emerald-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <Check className="w-3 h-3 stroke-[3]" />
                  <span>Proof Attached</span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="w-full h-44 rounded-2xl border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/50 flex flex-col items-center justify-center p-4 transition-all text-amber-900 group active:scale-98"
              >
                <div className="w-14 h-14 rounded-full bg-white text-amber-600 flex items-center justify-center shadow-md mb-2 group-hover:scale-105 transition-transform">
                  {uploadingPhoto ? (
                    <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
                  ) : (
                    <Camera className="w-7 h-7" />
                  )}
                </div>
                <span className="font-extrabold text-xs">
                  {uploadingPhoto ? "Compressing & Uploading..." : "Open Camera / Upload After Photo"}
                </span>
                <span className="text-[10px] text-slate-400 mt-1">
                  Device camera opens automatically on phone
                </span>
              </button>
            )}
          </div>

          {/* Materials Used Tags */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1.5">
              2. Materials & Equipment Used
            </label>
            <div className="flex flex-wrap gap-1.5">
              {materialsList.map((mat) => {
                const isSelected = selectedMaterials.includes(mat);
                return (
                  <button
                    key={mat}
                    type="button"
                    onClick={() => toggleMaterial(mat)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-[#0D7377] text-white shadow-xs"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {isSelected ? `✓ ${mat}` : `+ ${mat}`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Voice Dictation Notes */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700 block">
                3. Work Note / Field Certification
              </label>
              <button
                type="button"
                onClick={handleVoiceDictation}
                className={`text-xs font-bold flex items-center gap-1 px-2.5 py-1 rounded-lg transition-colors ${
                  isListening
                    ? "bg-rose-100 text-rose-700 animate-pulse"
                    : "text-[#0D7377] hover:bg-teal-50"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>{isListening ? "Listening..." : "Voice Dictate Note"}</span>
              </button>
            </div>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleared blockage, tested water flow, sprayed disinfectant..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 font-medium text-slate-800 resize-none"
            />
          </div>

          {/* Mark as Resolved Submit Button (Strictly Disabled until afterPhotoUrl attached) */}
          <button
            type="submit"
            disabled={!afterPhotoUrl || submittingResolve}
            className={`w-full py-3.5 px-4 rounded-xl text-xs font-extrabold shadow-md transition-all flex items-center justify-center gap-2 active:scale-98 ${
              afterPhotoUrl && !submittingResolve
                ? "bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                : "bg-slate-200 text-slate-400 cursor-not-allowed"
            }`}
          >
            {submittingResolve ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Submitting Verification to Citizen...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>{afterPhotoUrl ? "Mark as Resolved" : "Attach 'After' Photo to Resolve"}</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* If already resolved */}
      {job.status === "RESOLVED" && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-5 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <h3 className="text-sm font-bold text-emerald-950">
            Work Order Marked as Resolved
          </h3>
          <p className="text-xs text-emerald-800">
            Waiting for the citizen to inspect the before/after photos and confirm closure.
          </p>
        </div>
      )}
    </div>
  );
}
