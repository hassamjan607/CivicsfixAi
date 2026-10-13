"use client";

import React, { useState } from "react";
import CitizenSubmissionScreen from "./citizen/CitizenSubmissionScreen";
import ComplaintReceivedScreen from "./citizen/ComplaintReceivedScreen";
import TrackComplaintScreen from "./citizen/TrackComplaintScreen";
import CityOverviewDashboard from "./admin/CityOverviewDashboard";
import FieldOfficerScreen from "./officer/FieldOfficerScreen";
import RulesSimulatorScreen from "./simulator/RulesSimulatorScreen";
import { 
  CheckCircle2, 
  Sparkles,
  User,
  Wrench,
  Building2,
  Sliders
} from "lucide-react";

export type UserRole = "citizen" | "officer" | "admin" | "simulator";
export type CitizenScreenId = "submission" | "received" | "track";

export default function DesignPreviewSwitcher() {
  const [role, setRole] = useState<UserRole>("citizen");
  const [citizenScreen, setCitizenScreen] = useState<CitizenScreenId>("submission");
  const [currentTrackingId, setCurrentTrackingId] = useState<string>("CF-1042");

  const citizenScreens: { id: CitizenScreenId; name: string; pageLabel: string }[] = [
    { id: "submission", name: "Voice Intake", pageLabel: "Page 1" },
    { id: "received", name: "Score Breakdown", pageLabel: "Page 2" },
    { id: "track", name: "Track & Fix", pageLabel: "Page 3" },
  ];

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col font-sans">
      {/* Top Unified Role Switcher & Screen Navigation Bar - Light Theme */}
      <header className="bg-white/95 backdrop-blur-md text-slate-900 px-3 sm:px-6 py-3 border-b border-slate-200 shadow-xs sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Brand + Specification Label */}
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-full bg-[#0D5C63] flex items-center justify-center text-white font-bold text-xs shadow-xs ring-2 ring-teal-100">
              CF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-slate-900">
                  CivicFix AI
                </span>
                <span className="bg-teal-50 text-teal-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-teal-200">
                  Adaptive Portal
                </span>
              </div>
              <span className="text-[11px] text-slate-500 font-medium hidden sm:inline">
                Municipal AI Ecosystem
              </span>
            </div>
          </div>

          {/* Unified Role Switcher Pills (Citizen • Field Officer • City Admin • Simulator) */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 flex-wrap justify-center gap-1 shadow-inner">
            <button
              onClick={() => setRole("citizen")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                role === "citizen"
                  ? "bg-[#0D7377] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Citizen</span>
            </button>

            <button
              onClick={() => setRole("officer")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                role === "officer"
                  ? "bg-[#0D7377] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Field Officer</span>
            </button>

            <button
              onClick={() => setRole("admin")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                role === "admin"
                  ? "bg-[#0D7377] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>City Admin</span>
            </button>

            <button
              onClick={() => setRole("simulator")}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                role === "simulator"
                  ? "bg-[#0D7377] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Rules Simulator</span>
            </button>
          </div>

          {/* Citizen Sub-screens (Only when Citizen role is active) */}
          {role === "citizen" ? (
            <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto max-w-full shadow-inner">
              {citizenScreens.map((s) => {
                const isActive = citizenScreen === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setCitizenScreen(s.id)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all flex items-center space-x-1 ${
                      isActive
                        ? "bg-white text-teal-800 font-bold shadow-xs border border-teal-200"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    <span className="opacity-75 font-mono">{s.pageLabel}:</span>
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-700 font-semibold">Live System Connected</span>
            </div>
          )}
        </div>
      </header>

      {/* Screen Presentation Container - Automatically adapts to screen size */}
      <main className="flex-1 w-full p-2 sm:p-4 md:p-6 lg:p-8 overflow-y-auto flex items-start justify-center">
        <div className={`w-full ${role === "admin" || role === "simulator" ? "max-w-7xl" : "max-w-6xl"} mx-auto transition-all duration-300`}>
          {/* Citizen Role Views */}
          {role === "citizen" && citizenScreen === "submission" && (
            <CitizenSubmissionScreen
              onNavigateToReceived={(data) => {
                if (data?.trackingId) setCurrentTrackingId(data.trackingId);
                setCitizenScreen("received");
              }}
            />
          )}

          {role === "citizen" && citizenScreen === "received" && (
            <ComplaintReceivedScreen
              onBack={() => setCitizenScreen("submission")}
              onNavigateToTrack={() => setCitizenScreen("track")}
              trackingId={currentTrackingId}
            />
          )}

          {role === "citizen" && citizenScreen === "track" && (
            <TrackComplaintScreen
              onBack={() => setCitizenScreen("received")}
              defaultTrackingId={currentTrackingId}
            />
          )}

          {/* Field Officer Portal View */}
          {role === "officer" && (
            <FieldOfficerScreen
              onBackToCitizen={() => setRole("citizen")}
            />
          )}

          {/* City Admin Command Center View */}
          {role === "admin" && (
            <div className="w-full bg-white rounded-3xl overflow-hidden shadow-2xl border border-slate-200">
              <CityOverviewDashboard 
                onNavigateToCitizen={() => setRole("citizen")}
              />
            </div>
          )}

          {/* Rules Engine Simulator View */}
          {role === "simulator" && (
            <div className="w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-800">
              <RulesSimulatorScreen />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
