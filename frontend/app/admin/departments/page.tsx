"use client";

import React, { useState, useEffect } from "react";
import { Building2, Layers, Clock, Mail, CheckCircle2, Loader2 } from "lucide-react";

interface DepartmentData {
  id: string;
  name: string;
  code: string;
  categories: string;
  contactEmail: string;
  slaUrgentHours: number;
  slaStandardHours: number;
  officers?: { name: string }[];
  workers?: { name: string }[];
}

export default function AdminDepartmentsPage() {
  const [departments, setDepartments] = useState<DepartmentData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/departments")
      .then((r) => r.json())
      .then((data) => {
        if (data.departments) setDepartments(data.departments);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">
          Municipal Departments & SLA Parameters
        </h1>
        <p className="text-xs text-slate-500">
          Configure response thresholds and grievance jurisdictions across city agencies
        </p>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400 text-xs">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-teal-600 mb-2" />
          <span>Loading departments...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {departments.map((dept) => {
            const categories = typeof dept.categories === "string" ? JSON.parse(dept.categories || "[]") : dept.categories;
            return (
              <div
                key={dept.id}
                className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xs space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#0D7377] flex items-center justify-center font-bold">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{dept.name}</h3>
                      <span className="text-[10px] text-slate-400 font-mono">Agency Code: {dept.code}</span>
                    </div>
                  </div>

                  <span className="bg-teal-50 text-[#0D7377] text-xs font-bold px-2.5 py-0.5 rounded-full border border-teal-200">
                    Active Agency
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Supervising Contact:</span>
                    <span className="font-bold text-slate-800">{dept.contactEmail}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Urgent SLA Threshold:</span>
                    <span className="font-bold text-rose-700 font-mono">{dept.slaUrgentHours} Hours (Urgency &ge; 7)</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Standard SLA Threshold:</span>
                    <span className="font-bold text-slate-900 font-mono">{dept.slaStandardHours} Hours</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                    Jurisdiction Categories
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((cat: string, i: number) => (
                      <span
                        key={i}
                        className="bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-xl"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
