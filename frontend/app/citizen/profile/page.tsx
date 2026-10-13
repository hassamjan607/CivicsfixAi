"use client";

import React, { useState, useEffect } from "react";
import { User, Mail, Phone, Globe, Bell, CheckCircle2, Save } from "lucide-react";
import { useLanguage } from "@/lib/i18n";

export default function CitizenProfilePage() {
  const { lang, setLang } = useLanguage();
  const [user, setUser] = useState<{ name: string; email: string; phone?: string } | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Profile & Preferences</h1>
        <p className="text-xs text-slate-500">Manage your contact details, language, and notification channels</p>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-2xs space-y-6">
        {savedSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Preferences updated successfully.</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Full Name</label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="text"
                disabled
                value={user?.name || "Citizen"}
                className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
              <input
                type="email"
                disabled
                value={user?.email || "citizen@civicfix.pk"}
                className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 bg-slate-50 font-medium text-slate-700"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">Preferred Language</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLang("en")}
                className={`p-3 rounded-xl text-xs font-bold border transition-all ${
                  lang === "en" ? "border-teal-600 bg-teal-50 text-[#0D7377]" : "border-slate-200 text-slate-600"
                }`}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLang("ur")}
                className={`p-3 rounded-xl text-xs font-bold border transition-all ${
                  lang === "ur" ? "border-teal-600 bg-teal-50 text-[#0D7377]" : "border-slate-200 text-slate-600"
                }`}
              >
                اردو (Urdu)
              </button>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-3">
            <span className="text-xs font-bold text-slate-700 block">Notification Preferences</span>
            <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={emailAlerts}
                onChange={(e) => setEmailAlerts(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 accent-[#0D7377]"
              />
              <span>Send instant email updates when complaint status changes</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-700 font-medium">
              <input
                type="checkbox"
                checked={smsAlerts}
                onChange={(e) => setSmsAlerts(e.target.checked)}
                className="w-4 h-4 rounded text-teal-600 accent-[#0D7377]"
              />
              <span>Send emergency SMS alerts for high-priority hazards</span>
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-98"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Preferences</span>
          </button>
        </form>
      </div>
    </div>
  );
}
