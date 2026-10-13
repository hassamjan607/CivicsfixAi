"use client";

import React, { useState } from "react";
import { 
  Mic, 
  LayoutDashboard, 
  AlertTriangle, 
  Map, 
  DollarSign, 
  FileText, 
  Users, 
  Building, 
  ChevronDown, 
  Filter, 
  CheckCircle2, 
  Clock, 
  Flame, 
  ArrowUpRight,
  Menu,
  X,
  Search,
  MapPin,
  TrendingUp,
  RefreshCw,
  Bell,
  SlidersHorizontal
} from "lucide-react";

interface Props {
  onNavigateToCitizen?: () => void;
}

export default function CityOverviewDashboard({ onNavigateToCitizen }: Props) {
  const [activeTab, setActiveTab] = useState<string>("Overview");
  const [selectedTime, setSelectedTime] = useState<string>("Last 7 days");
  const [selectedCategory, setSelectedCategory] = useState<string>("All categories");
  const [selectedDept, setSelectedDept] = useState<string>("All departments");
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedHotspot, setSelectedHotspot] = useState<number | null>(null);

  // Time filter options
  const timeOptions = ["Today", "Last 7 days", "Last 30 days", "This Quarter"];
  const categoryOptions = ["All categories", "Sewage", "Roads", "Garbage", "Electricity", "Streetlights"];
  const deptOptions = ["All departments", "WASA (Water)", "TEPA (Roads)", "LWMC (Waste)", "LESCO (Power)"];

  const categoriesData = [
    { name: "Sewage", count: 86, max: 100, color: "bg-[#0D7377]" },
    { name: "Roads", count: 64, max: 100, color: "bg-[#0B3B48]" },
    { name: "Garbage", count: 52, max: 100, color: "bg-[#0E2038]" },
    { name: "Electricity", count: 31, max: 100, color: "bg-[#334155]" },
    { name: "Streetlights", count: 22, max: 100, color: "bg-[#475569]" }
  ];

  const hotspots = [
    {
      id: 1,
      title: "Mochi Gate Ward (Lahore Central)",
      category: "Sewage Overflow Cluster",
      severity: "Urgency 9/10",
      complaints: 14,
      desc: "Severe subterranean sewage blockage flooding residential lane.",
      action: "Excavator team & high-pressure suction pump deployed.",
      left: "28%",
      top: "35%",
      color: "bg-red-500"
    },
    {
      id: 2,
      title: "Mall Road Junction",
      category: "Road & Pothole Hazard",
      severity: "Urgency 8/10",
      complaints: 9,
      desc: "Deep trench left after underground pipe repair, causing traffic hazard.",
      action: "Asphalt patch truck scheduled for tonight 11:00 PM.",
      left: "54%",
      top: "32%",
      color: "bg-orange-500"
    },
    {
      id: 3,
      title: "Gulberg III Industrial Area",
      category: "Streetlight Circuit Outage",
      severity: "Urgency 7/10",
      complaints: 6,
      desc: "Transformer trip resulting in 12 consecutive streetlights off.",
      action: "LESCO technical inspector investigating transformer relay.",
      left: "44%",
      top: "60%",
      color: "bg-teal-500"
    }
  ];

  const [urgentComplaints, setUrgentComplaints] = useState([
    {
      id: "CF-1042",
      urgency: 10,
      urgencyColor: "bg-[#DC2626]",
      category: "Live wire",
      department: "Electricity",
      sla: "1 h 12 m left",
      slaColor: "text-slate-600",
      status: "In progress",
      statusBadge: "bg-[#D1F2EE] text-[#0A6B6D]"
    },
    {
      id: "CF-1001",
      urgency: 8,
      urgencyColor: "bg-[#C2410C]",
      category: "Sewage",
      department: "Water and Sanitation",
      sla: "23 h left",
      slaColor: "text-slate-600",
      status: "Pending",
      statusBadge: "bg-[#FEF3C7] text-[#92400E]"
    },
    {
      id: "CF-0988",
      urgency: 7,
      urgencyColor: "bg-[#B45309]",
      category: "Pothole near school",
      department: "Roads",
      sla: "Overdue 4 h",
      slaColor: "text-[#DC2626] font-semibold",
      status: "Escalated",
      statusBadge: "bg-[#FEE2E2] text-[#991B1B]"
    },
    {
      id: "CF-0899",
      urgency: 6,
      urgencyColor: "bg-amber-600",
      category: "Garbage dump",
      department: "Waste Management",
      sla: "14 h left",
      slaColor: "text-slate-600",
      status: "In progress",
      statusBadge: "bg-[#D1F2EE] text-[#0A6B6D]"
    }
  ]);

  const toggleComplaintStatus = (idx: number) => {
    setUrgentComplaints(prev => {
      const next = [...prev];
      const current = next[idx].status;
      if (current === "Pending") {
        next[idx].status = "In progress";
        next[idx].statusBadge = "bg-[#D1F2EE] text-[#0A6B6D]";
      } else if (current === "In progress") {
        next[idx].status = "Resolved";
        next[idx].statusBadge = "bg-emerald-100 text-emerald-800";
      } else {
        next[idx].status = "Pending";
        next[idx].statusBadge = "bg-[#FEF3C7] text-[#92400E]";
      }
      return next;
    });
  };

  const filteredComplaints = urgentComplaints.filter(c => {
    const matchesSearch = c.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === "All categories" || c.category.toLowerCase().includes(selectedCategory.toLowerCase());
    return matchesSearch && matchesCat;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col lg:flex-row font-sans text-slate-800 antialiased">
      {/* Mobile Top Navigation Bar (Phone & Tablet) */}
      <header className="lg:hidden bg-[#0A192F] text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 sticky top-0 z-40 shadow-md">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-full bg-[#0D5C63] flex items-center justify-center text-white font-bold text-xs">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <span className="font-bold text-sm text-white block">CivicFix AI</span>
            <span className="text-[10px] text-teal-400 font-mono">Command Center</span>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {onNavigateToCitizen && (
            <button
              onClick={onNavigateToCitizen}
              className="text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-200 px-2.5 py-1.5 rounded-lg border border-slate-700 flex items-center gap-1"
            >
              <span>Citizen View</span>
              <ArrowUpRight className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={() => setMobileMenuOpen(prev => !prev)}
            className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-slate-800/80"
            title="Toggle Menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Slide-Over Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex">
          <div className="w-72 bg-[#0A192F] text-slate-300 h-full p-5 flex flex-col justify-between shadow-2xl animate-in slide-in-from-left duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <span className="font-bold text-white text-base">Dashboard Menu</span>
                <button 
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="mt-4 space-y-1">
                {[
                  { name: "Overview", icon: LayoutDashboard },
                  { name: "Complaints", icon: FileText },
                  { name: "Risk map", icon: Map },
                  { name: "Budget", icon: DollarSign },
                  { name: "Audit log", icon: AlertTriangle },
                  { name: "Users", icon: Users },
                  { name: "Departments", icon: Building },
                ].map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.name;
                  return (
                    <button
                      key={item.name}
                      onClick={() => {
                        setActiveTab(item.name);
                        setMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                        isActive
                          ? "bg-[#1E293B] text-white shadow-sm"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0" />
                      <span>{item.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <span className="bg-[#0D5C63] text-white text-xs font-bold px-3 py-1 rounded-full">
                Admin
              </span>
              <span className="text-xs text-slate-400">v1.2 Live</span>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileMenuOpen(false)} />
        </div>
      )}

      {/* Desktop Navy Sidebar */}
      <aside className="hidden lg:flex w-64 bg-[#0A192F] text-slate-300 flex-col justify-between shrink-0 shadow-xl border-r border-slate-900 select-none">
        <div>
          {/* Logo Header */}
          <div className="p-6 flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-[#0D5C63] flex items-center justify-center text-white shadow-sm shrink-0">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-white block leading-tight">
                CivicFix AI
              </span>
              <span className="text-[10px] text-teal-400 font-mono tracking-wider uppercase block">
                Command Center
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-2 space-y-1">
            {[
              { name: "Overview", icon: LayoutDashboard },
              { name: "Complaints", icon: FileText },
              { name: "Risk map", icon: Map },
              { name: "Budget", icon: DollarSign },
              { name: "Audit log", icon: AlertTriangle },
              { name: "Users", icon: Users },
              { name: "Departments", icon: Building },
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => setActiveTab(item.name)}
                  className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-[#1E293B] text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.name}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile / Admin Badge */}
        <div className="p-6 border-t border-slate-800/80 flex items-center justify-between">
          <div className="inline-block bg-[#0D5C63] text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-sm">
            Admin
          </div>
          {onNavigateToCitizen && (
            <button
              onClick={onNavigateToCitizen}
              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              title="Go to citizen view"
            >
              <span>Citizen View</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        {/* Top Header & Interactive Filter Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
              City overview
            </h1>
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>Lahore Metropolitan Corporation</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-emerald-700 font-semibold">Live System</span>
            </p>
          </div>

          {/* Interactive Filter Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Time Filter Dropdown */}
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="bg-[#0A192F] text-white px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm outline-none cursor-pointer"
            >
              {timeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* Category Filter Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm outline-none cursor-pointer"
            >
              {categoryOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            {/* Department Filter Dropdown */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="bg-white border border-slate-200 text-slate-700 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-sm outline-none cursor-pointer hidden sm:block"
            >
              {deptOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 4 KPI Metric Cards (Responsive Grid: 1 col on mobile, 2 col on tablet, 4 col on desktop) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6 md:mb-8">
          {/* Card 1: OPEN COMPLAINTS */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              OPEN COMPLAINTS
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                128
              </span>
              <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                +12 today
              </span>
            </div>
          </div>

          {/* Card 2: RESOLVED */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              RESOLVED
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold text-[#0D7377] tracking-tight">
                412
              </span>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                94% rate
              </span>
            </div>
          </div>

          {/* Card 3: AVERAGE DAYS TO FIX */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              AVERAGE DAYS TO FIX
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                3.4
              </span>
              <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                -0.6 days
              </span>
            </div>
          </div>

          {/* Card 4: SLA BREACHES */}
          <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2">
              SLA BREACHES
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl sm:text-4xl font-extrabold text-[#DC2626] tracking-tight">
                9
              </span>
              <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                Needs attention
              </span>
            </div>
          </div>
        </div>

        {/* Middle Section: Heatmap (Left) + By Category (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6 md:mb-8">
          {/* Heatmap Card (7 cols) */}
          <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 leading-tight">
                  Complaint heatmap
                </h2>
                <span className="text-xs text-slate-400">Click any hotspot pin to inspect</span>
              </div>
              <span className="bg-[#FEF2F2] text-[#DC2626] border border-[#FECACA] px-3 py-1 rounded-full text-xs font-bold">
                3 root-cause spots
              </span>
            </div>

            {/* Heatmap Canvas Graphic with interactive glowing spots */}
            <div className="relative h-64 sm:h-72 rounded-2xl bg-[#F8FAFC] border border-slate-200 overflow-hidden flex items-center justify-center">
              {/* Subtle City Map Grid Lines */}
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `linear-gradient(#94A3B8 1px, transparent 1px), linear-gradient(90deg, #94A3B8 1px, transparent 1px)`,
                  backgroundSize: '24px 24px'
                }}
              />

              {/* Major Roads / River Curves */}
              <svg className="absolute inset-0 w-full h-full opacity-35" viewBox="0 0 400 250">
                <path d="M 0 100 Q 150 140 250 80 T 400 120" stroke="#CBD5E1" strokeWidth="8" fill="none" />
                <path d="M 120 0 Q 180 120 220 250" stroke="#CBD5E1" strokeWidth="6" fill="none" />
                <path d="M 280 0 Q 260 140 350 250" stroke="#E2E8F0" strokeWidth="4" fill="none" />
              </svg>

              {/* Glowing Heatmap Spots */}
              <div 
                className="absolute w-28 h-28 rounded-full blur-2xl opacity-60"
                style={{
                  left: "28%",
                  top: "35%",
                  background: "radial-gradient(circle, #EF4444 0%, #F87171 60%, transparent 100%)"
                }}
              />
              <div 
                className="absolute w-36 h-36 rounded-full blur-2xl opacity-50"
                style={{
                  left: "52%",
                  top: "32%",
                  background: "radial-gradient(circle, #F97316 0%, #FB923C 60%, transparent 100%)"
                }}
              />
              <div 
                className="absolute w-20 h-20 rounded-full blur-2xl opacity-50"
                style={{
                  left: "44%",
                  top: "60%",
                  background: "radial-gradient(circle, #10B981 0%, #34D399 60%, transparent 100%)"
                }}
              />

              {/* Interactive Hotspot Pins */}
              {hotspots.map((h) => (
                <button
                  key={h.id}
                  onClick={() => setSelectedHotspot(selectedHotspot === h.id ? null : h.id)}
                  style={{ left: h.left, top: h.top }}
                  className="absolute transform -translate-x-1/2 -translate-y-1/2 group z-20 focus:outline-none"
                  title={h.title}
                >
                  <div className={`w-6 h-6 rounded-full ${h.color} text-white font-black text-[10px] flex items-center justify-center shadow-lg ring-4 ring-white hover:scale-125 transition-transform`}>
                    {h.id}
                  </div>
                </button>
              ))}

              {/* Center Map Label */}
              <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-200 text-[10px] text-slate-700 font-semibold shadow-xs">
                Active Sector: Lahore Central
              </div>
            </div>

            {/* Clicked Hotspot Inspection Drawer */}
            {selectedHotspot && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-start justify-between animate-in fade-in duration-200">
                {(() => {
                  const spot = hotspots.find(h => h.id === selectedHotspot);
                  if (!spot) return null;
                  return (
                    <div className="flex-1 pr-3">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-bold text-xs text-amber-900">{spot.title}</span>
                        <span className="text-[10px] bg-red-600 text-white font-bold px-2 py-0.5 rounded-full">{spot.severity}</span>
                      </div>
                      <p className="text-xs text-slate-700 leading-snug">{spot.desc}</p>
                      <p className="text-[11px] text-teal-800 font-semibold mt-1">Action: {spot.action}</p>
                    </div>
                  );
                })()}
                <button
                  onClick={() => setSelectedHotspot(null)}
                  className="text-xs font-bold text-amber-900 hover:text-black p-1"
                >
                  ✕
                </button>
              </div>
            )}
          </div>

          {/* By Category Card (5 cols) */}
          <div className="lg:col-span-5 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-slate-900">
                By category
              </h2>
              <span className="text-xs text-slate-400">Total: 255</span>
            </div>

            <div className="space-y-4">
              {categoriesData.map((item) => (
                <div 
                  key={item.name} 
                  onClick={() => setSelectedCategory(selectedCategory === item.name ? "All categories" : item.name)}
                  className={`p-2 rounded-xl transition-colors cursor-pointer ${
                    selectedCategory === item.name ? "bg-teal-50 border border-teal-200" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                    <span className="text-slate-800">
                      {item.name}
                    </span>
                    <span className="text-slate-900 font-mono font-bold">
                      {item.count}
                    </span>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`${item.color} h-full rounded-full transition-all duration-700`}
                      style={{ width: `${item.count}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Card: "Needs attention first" Table */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 sm:p-6 overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Needs attention first
              </h2>
              <span className="text-xs text-slate-400">Click any status pill to cycle status</span>
            </div>

            {/* Table Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search complaint..."
                className="bg-[#F8FAFC] border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-[#0D5C63] w-full sm:w-56"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[540px]">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-bold uppercase tracking-wider">
                  <th className="pb-3 pr-4">URGENCY</th>
                  <th className="pb-3 pr-4">ID / CATEGORY</th>
                  <th className="pb-3 pr-4">DEPARTMENT</th>
                  <th className="pb-3 pr-4">SLA</th>
                  <th className="pb-3 text-right">ACTION / STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredComplaints.map((c, i) => (
                  <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                    {/* Urgency Badge */}
                    <td className="py-3.5 pr-4">
                      <div className={`w-7 h-7 rounded-full ${c.urgencyColor} text-white font-bold flex items-center justify-center text-xs shadow-xs`}>
                        {c.urgency}
                      </div>
                    </td>

                    {/* ID / Category */}
                    <td className="py-3.5 pr-4">
                      <span className="font-bold text-slate-900 block">{c.category}</span>
                      <span className="font-mono text-[10px] text-slate-400">{c.id}</span>
                    </td>

                    {/* Department */}
                    <td className="py-3.5 pr-4 text-slate-600">
                      {c.department}
                    </td>

                    {/* SLA */}
                    <td className={`py-3.5 pr-4 ${c.slaColor}`}>
                      {c.sla}
                    </td>

                    {/* Status Badge with interactive click to change */}
                    <td className="py-3.5 text-right">
                      <button
                        onClick={() => toggleComplaintStatus(i)}
                        className={`px-3 py-1 rounded-full text-xs font-bold inline-block hover:scale-105 active:scale-95 transition-transform ${c.statusBadge}`}
                        title="Click to cycle status"
                      >
                        {c.status}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
