"use client";

import React, { useState, useEffect } from "react";
import { 
  Wrench, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  Camera, 
  Navigation, 
  Phone, 
  ChevronRight, 
  Sparkles, 
  Check, 
  Filter, 
  Search, 
  ArrowLeft,
  Truck,
  ShieldAlert,
  Flame,
  Upload,
  Calendar,
  Layers,
  Map as MapIcon,
  List
} from "lucide-react";

interface Props {
  onBackToCitizen?: () => void;
  isWideView?: boolean;
}

interface WorkOrder {
  id: string;
  trackingId: string;
  category: string;
  title: string;
  address: string;
  distance: string;
  urgency: number;
  urgencyColor: string;
  slaMinutesLeft: number;
  status: "Assigned" | "On Route" | "Arrived" | "In Progress" | "Resolved";
  citizenQuote: string;
  citizenPhone: string;
  beforePhotoUrl?: string;
  afterPhotoUrl?: string;
  materials?: string[];
  notes?: string;
}

export default function FieldOfficerScreen({ 
  onBackToCitizen,
  isWideView = false 
}: Props) {
  const [activeTab, setActiveTab] = useState<"tasks" | "map" | "completed">("tasks");
  const [filter, setFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedTask, setSelectedTask] = useState<WorkOrder | null>(null);
  const [isOnDuty, setIsOnDuty] = useState<boolean>(true);
  const [showNavModal, setShowNavModal] = useState<boolean>(false);
  const [afterPhotoPreview, setAfterPhotoPreview] = useState<string | null>(null);
  const [workNotes, setWorkNotes] = useState<string>("");
  const [selectedMaterial, setSelectedMaterial] = useState<string>("Standard Pipe Seal");
  const [resolutionSuccess, setResolutionSuccess] = useState<boolean>(false);

  // Mock Work Orders for Field Officer Tariq Mehmood (WASA Rapid Team 4)
  const [tasks, setTasks] = useState<WorkOrder[]>([
    {
      id: "WO-901",
      trackingId: "CF-1042",
      category: "Sewage",
      title: "Main Street 4 Sewage Overflow",
      address: "Street 4, Sector B, Lahore Central",
      distance: "0.6 km away",
      urgency: 8,
      urgencyColor: "bg-[#F97316]",
      slaMinutesLeft: 1420, // ~23.6 hours
      status: "In Progress",
      citizenQuote: "Hamari gali mein gutter ubal raha hai aur paani gharon ke samne jama ho gaya hai.",
      citizenPhone: "0300-1234567",
      notes: "Submersible dewatering pump deployed."
    },
    {
      id: "WO-902",
      trackingId: "CF-1055",
      category: "Sewage",
      title: "Blocked Manhole & Biohazard Spillage",
      address: "Plot 18, Block G, Near Al-Razi Clinic",
      distance: "1.2 km away",
      urgency: 9,
      urgencyColor: "bg-[#DC2626]",
      slaMinutesLeft: 195, // 3h 15m
      status: "Assigned",
      citizenQuote: "Clinic ke samne drain bund ho chuka hai, mareezon ke liye rasta nahi.",
      citizenPhone: "0321-9876543"
    },
    {
      id: "WO-903",
      trackingId: "CF-1018",
      category: "Water Supply",
      title: "High Pressure Pipe Fracture on Main Road",
      address: "Main Boulevard Corner, Ward 12",
      distance: "2.4 km away",
      urgency: 10,
      urgencyColor: "bg-[#DC2626]",
      slaMinutesLeft: 52, // 52 minutes (URGENT SLA)
      status: "Assigned",
      citizenQuote: "Paani ki pipeline phatt gayi hai, hazaron gallon zaya ho raha hai.",
      citizenPhone: "0333-5551212"
    },
    {
      id: "WO-904",
      trackingId: "CF-0988",
      category: "Sewage",
      title: "Commercial Market Drain Clog",
      address: "Anarkali Bazaar Lane 2",
      distance: "3.1 km away",
      urgency: 6,
      urgencyColor: "bg-amber-600",
      slaMinutesLeft: 2100,
      status: "Resolved",
      citizenQuote: "Kachra phansa hua tha gutter mein.",
      citizenPhone: "0345-4443322",
      notes: "Trash cleared, 40 meters line jetted clean."
    }
  ]);

  // If none selected, default to the active task
  useEffect(() => {
    if (!selectedTask && tasks.length > 0) {
      setSelectedTask(tasks[0]);
    }
  }, [tasks, selectedTask]);

  const handleUpdateStatus = (newStatus: WorkOrder["status"]) => {
    if (!selectedTask) return;
    const updated = { ...selectedTask, status: newStatus };
    setSelectedTask(updated);
    setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const url = URL.createObjectURL(file);
      setAfterPhotoPreview(url);
    }
  };

  const handleCompleteTask = () => {
    if (!selectedTask) return;
    const completedTask: WorkOrder = {
      ...selectedTask,
      status: "Resolved",
      afterPhotoUrl: afterPhotoPreview || undefined,
      notes: workNotes || "Repaired and inspected by Rapid Unit 4.",
      materials: [selectedMaterial]
    };
    setSelectedTask(completedTask);
    setTasks(prev => prev.map(t => t.id === completedTask.id ? completedTask : t));
    setResolutionSuccess(true);
    setTimeout(() => setResolutionSuccess(false), 3000);
  };

  const formatSLA = (mins: number) => {
    if (mins <= 60) return `${mins}m left`;
    const hours = Math.floor(mins / 60);
    const m = mins % 60;
    return `${hours}h ${m}m left`;
  };

  const filteredTasks = tasks.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.trackingId.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.address.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === "urgent") return matchesSearch && t.slaMinutesLeft < 240 && t.status !== "Resolved";
    if (filter === "in_progress") return matchesSearch && t.status === "In Progress";
    if (filter === "resolved") return matchesSearch && t.status === "Resolved";
    return matchesSearch;
  });

  return (
    <div className="w-full mx-auto bg-[#F8FAFC] min-h-screen sm:min-h-[680px] md:min-h-[760px] flex flex-col justify-between shadow-xl relative font-sans text-slate-800 transition-all duration-300 max-w-full lg:max-w-6xl sm:rounded-3xl border border-slate-200 overflow-hidden">
      {/* Top Header: Officer Badge & Status - Light Theme */}
      <header className="bg-white text-slate-900 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-200 sticky top-0 z-20 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#0D5C63] flex items-center justify-center text-white font-bold shadow-xs ring-2 ring-teal-100">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold text-slate-900 tracking-tight">
                  Officer Tariq Mehmood
                </span>
                <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 font-bold px-2 py-0.5 rounded-full font-mono">
                  #WASA-409
                </span>
              </div>
              <span className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5 font-medium">
                <span>Rapid Response Unit 4</span>
                <span>•</span>
                <span className="text-teal-700 font-semibold">Central Division</span>
              </span>
            </div>
          </div>

          {/* On Duty Toggle Pill */}
          <button
            onClick={() => setIsOnDuty(prev => !prev)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all flex items-center space-x-1.5 shadow-xs ${
              isOnDuty 
                ? "bg-emerald-50 border border-emerald-300 text-emerald-800" 
                : "bg-slate-100 border border-slate-200 text-slate-500"
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnDuty ? "bg-emerald-500 animate-ping" : "bg-slate-400"}`} />
            <span>{isOnDuty ? "On Duty" : "On Break"}</span>
          </button>
        </div>

        {/* Quick KPI Strip */}
        <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-center">
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Assigned</span>
            <span className="text-base font-extrabold text-amber-700 font-mono">3 Pending</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Completed</span>
            <span className="text-base font-extrabold text-emerald-700 font-mono">4 Today</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/80">
            <span className="text-[10px] uppercase font-bold text-slate-500 block">SLA Rate</span>
            <span className="text-base font-extrabold text-teal-700 font-mono">98% On-Time</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 px-4 sm:px-6 py-4 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start pb-20 lg:pb-8">
        {/* Left Section: Work Orders Queue */}
        <div className="w-full lg:col-span-5 space-y-3">
          {/* Search & Filter Header */}
          <div className="space-y-2">
            <div className="bg-white border border-slate-200 rounded-2xl px-3 py-1.5 flex items-center justify-between shadow-xs">
              <Search className="w-4 h-4 text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search ticket or location..."
                className="text-xs text-slate-800 outline-none bg-transparent flex-1 font-medium"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center space-x-1 overflow-x-auto py-0.5 text-xs">
              {[
                { id: "all", label: "All (4)" },
                { id: "urgent", label: "🚨 Urgent SLA (1)" },
                { id: "in_progress", label: "Active (1)" },
                { id: "resolved", label: "Done (1)" },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all ${
                    filter === f.id
                      ? "bg-[#0D5C63] text-white shadow-xs"
                      : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Work Orders List */}
          <div className="space-y-2.5">
            {filteredTasks.map((task) => {
              const isSelected = selectedTask?.id === task.id;
              const isUrgent = task.slaMinutesLeft < 180 && task.status !== "Resolved";

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTask(task)}
                  className={`p-3.5 rounded-2xl border transition-all cursor-pointer shadow-xs ${
                    isSelected
                      ? "bg-white border-[#0D5C63] ring-2 ring-[#0D5C63]/20 shadow-md"
                      : "bg-white border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1.5">
                    <div className="flex items-center space-x-2">
                      <div className={`w-6 h-6 rounded-lg ${task.urgencyColor} text-white font-extrabold text-[11px] flex items-center justify-center shadow-xs`}>
                        {task.urgency}
                      </div>
                      <div>
                        <span className="font-mono text-xs font-bold text-slate-900 block leading-tight">
                          {task.trackingId}
                        </span>
                        <span className="text-[10px] text-slate-400 font-semibold">{task.category}</span>
                      </div>
                    </div>

                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      task.status === "Resolved"
                        ? "bg-emerald-100 text-emerald-800"
                        : task.status === "In Progress"
                        ? "bg-teal-100 text-teal-800"
                        : isUrgent
                        ? "bg-rose-100 text-rose-800 animate-pulse"
                        : "bg-amber-100 text-amber-800"
                    }`}>
                      {task.status}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-800 mb-1 leading-snug">
                    {task.title}
                  </h3>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100 mt-2">
                    <span className="flex items-center gap-1 truncate max-w-[190px]">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{task.address}</span>
                    </span>
                    <span className={`font-mono font-bold ${isUrgent ? "text-red-600" : "text-amber-600"}`}>
                      {formatSLA(task.slaMinutesLeft)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Section: Selected Work Order Details & Action Console */}
        {selectedTask && (
          <div className="w-full lg:col-span-7 space-y-4 mt-3 lg:mt-0">
            {/* Task Card Header */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    ACTIVE WORK ORDER • {selectedTask.id}
                  </span>
                  <h2 className="text-base font-extrabold text-slate-900 tracking-tight leading-snug mt-0.5">
                    {selectedTask.title}
                  </h2>
                  <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1">
                    <MapPin className="w-3.5 h-3.5 text-teal-700" />
                    <span className="font-medium text-slate-700">{selectedTask.address}</span>
                    <span className="text-teal-700 font-bold">({selectedTask.distance})</span>
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">SLA Clock</span>
                  <span className="text-sm font-mono font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200">
                    {formatSLA(selectedTask.slaMinutesLeft)}
                  </span>
                </div>
              </div>

              {/* Citizen Voice Snippet */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Citizen Voice Transcript (Urdu)
                </span>
                <p className="text-xs text-slate-800 italic leading-relaxed">
                  &quot;{selectedTask.citizenQuote}&quot;
                </p>
              </div>

              {/* Quick Action Dial / GPS buttons */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  onClick={() => setShowNavModal(true)}
                  className="bg-[#0A192F] hover:bg-[#1E293B] text-white py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 active:scale-95"
                >
                  <Navigation className="w-3.5 h-3.5 text-teal-400" />
                  <span>Start GPS Route</span>
                </button>
                <a
                  href={`tel:${selectedTask.citizenPhone}`}
                  className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 py-2.5 px-3 rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2"
                >
                  <Phone className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Call Reporter</span>
                </a>
              </div>
            </div>

            {/* Interactive Progress Stepper */}
            <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Field Execution Status
              </h3>

              <div className="grid grid-cols-4 gap-1.5 text-center text-xs">
                {[
                  { status: "Assigned" as const, label: "1. Assigned" },
                  { status: "On Route" as const, label: "2. En Route" },
                  { status: "In Progress" as const, label: "3. On Site" },
                  { status: "Resolved" as const, label: "4. Finished" },
                ].map((s) => {
                  const isActive = selectedTask.status === s.status;
                  return (
                    <button
                      key={s.status}
                      onClick={() => handleUpdateStatus(s.status)}
                      className={`py-2 px-1 rounded-xl font-bold transition-all text-[11px] ${
                        isActive
                          ? "bg-[#0D5C63] text-white shadow-sm ring-2 ring-teal-200"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Proof of Work & Resolution Action Console */}
            <div className="bg-[#0B1E36] text-white rounded-3xl p-5 border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Camera className="w-4 h-4 text-teal-400" />
                  <span>Upload Resolution Proof (After Photo)</span>
                </h3>
                <span className="text-[10px] text-teal-300 font-mono">Camera / Evidence</span>
              </div>

              {/* Photo Upload Box */}
              <div>
                <label className="cursor-pointer block">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoUpload}
                  />
                  {afterPhotoPreview ? (
                    <div className="relative rounded-2xl overflow-hidden border border-teal-500/50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={afterPhotoPreview} alt="Work resolution" className="w-full h-40 object-cover" />
                      <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                        Proof Attached
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white text-[10px] px-2.5 py-1 rounded-md font-mono">
                        GPS Timestamped: {new Date().toLocaleTimeString()}
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-600 hover:border-teal-400 rounded-2xl p-6 text-center bg-slate-900/50 transition-colors">
                      <Camera className="w-8 h-8 text-teal-400 mx-auto mb-2" />
                      <span className="text-xs font-bold text-white block">
                        Tap to Capture &quot;After&quot; Repair Photo
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Geo-tagged photo verified for Citizen Before/After slider
                      </span>
                    </div>
                  )}
                </label>
              </div>

              {/* Materials & Work Notes */}
              <div className="space-y-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                    Equipment / Materials Used
                  </label>
                  <select
                    value={selectedMaterial}
                    onChange={(e) => setSelectedMaterial(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-teal-400"
                  >
                    <option value="Standard Pipe Seal">Standard Pipe Seal & Flush</option>
                    <option value="6-inch PVC Pipe Coupler">6-inch PVC Pipe Coupler Replacement</option>
                    <option value="Submersible Vacuum Extraction">Submersible Vacuum Extraction & Disinfectant</option>
                    <option value="Cold Mix Asphalt Patch">Cold Mix Asphalt 25kg Patch</option>
                    <option value="45W LED Street Fixture">45W LED Street Fixture</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold uppercase text-slate-400 block mb-1">
                    Inspection Remarks
                  </label>
                  <input
                    type="text"
                    value={workNotes}
                    onChange={(e) => setWorkNotes(e.target.value)}
                    placeholder="e.g. Cleared blockage, water flow fully restored."
                    className="w-full bg-slate-900 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs outline-none focus:border-teal-400"
                  />
                </div>
              </div>

              {/* Resolution Action Button */}
              <button
                onClick={handleCompleteTask}
                className="w-full bg-[#0D7377] hover:bg-[#0F8A8F] active:scale-95 text-white font-extrabold py-3.5 px-4 rounded-2xl text-xs transition-all shadow-lg flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Mark as Resolved & Update Citizen</span>
              </button>

              {resolutionSuccess && (
                <div className="bg-emerald-950/80 border border-emerald-500/50 p-2.5 rounded-xl text-center text-xs text-emerald-300 font-bold flex items-center justify-center gap-1.5 animate-in fade-in duration-200">
                  <Check className="w-4 h-4" />
                  <span>Proof submitted! Sent to Citizen verification screen.</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Simulated GPS Navigation Modal */}
      {showNavModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-teal-700" />
                <span>Turn-by-Turn GPS Navigation</span>
              </span>
              <button 
                onClick={() => setShowNavModal(false)}
                className="text-xs font-bold text-slate-400 hover:text-black p-1"
              >
                ✕
              </button>
            </div>

            <div className="h-44 bg-slate-100 rounded-2xl border border-slate-200 relative overflow-hidden flex items-center justify-center">
              {/* Map grid */}
              <div 
                className="absolute inset-0 opacity-30"
                style={{
                  backgroundImage: `linear-gradient(#94A3B8 1px, transparent 1px), linear-gradient(90deg, #94A3B8 1px, transparent 1px)`,
                  backgroundSize: '20px 20px'
                }}
              />
              <div className="relative text-center p-4">
                <Truck className="w-8 h-8 text-[#0D5C63] mx-auto mb-1 animate-bounce" />
                <span className="font-extrabold text-sm text-slate-900 block">Head East on Mall Rd</span>
                <span className="text-xs text-teal-700 font-semibold">ETA: 4 mins (0.6 km)</span>
              </div>
            </div>

            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
              Destination: <strong className="text-slate-900">{selectedTask?.address}</strong>
            </div>

            <button
              onClick={() => {
                handleUpdateStatus("Arrived");
                setShowNavModal(false);
              }}
              className="w-full bg-[#0D5C63] text-white py-3 rounded-xl text-xs font-bold shadow-md hover:bg-[#0A4D54]"
            >
              Confirm Arrival on Site
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
