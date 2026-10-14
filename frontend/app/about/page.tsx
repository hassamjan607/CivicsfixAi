"use client";

import React, { useState } from "react";
import Link from "next/link";
import { 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  HelpCircle, 
  Mail, 
  Send, 
  CheckCircle2, 
  Calculator, 
  FileText,
  Lock,
  Building2,
  AlertTriangle
} from "lucide-react";

export default function AboutPage() {
  const [contactSubmitted, setContactSubmitted] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", message: "" });

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.name && formData.email && formData.message) {
      setContactSubmitted(true);
      setTimeout(() => {
        setFormData({ name: "", email: "", message: "" });
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-[1400px] w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="text-xs font-bold text-[#0D7377] hover:text-[#095256] flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-sm text-slate-900">CivicFix AI</span>
            <span className="text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-semibold">About & Methodology</span>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-12 space-y-12">
        {/* Mission Header */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-1.5 bg-teal-50 border border-teal-200 text-[#0D7377] text-xs font-bold px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Civic Technology Mission</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            Restoring Trust in Municipal Public Works
          </h1>
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto leading-relaxed">
            CivicFix AI bridges the communication gap between citizens and local government. By transforming voice complaints into structured, explainable tickets, we eliminate arbitrary queues and guarantee transparent resolution with verified photo proof.
          </p>
        </section>

        {/* How Urgency is Scored - Plain Rules with Example */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#0D7377] flex items-center justify-center font-bold">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                How Urgency is Scored (1 to 10 Scale)
              </h2>
              <p className="text-xs text-slate-500">
                Every ticket is scored by deterministic, explainable rules—never a hidden black box.
              </p>
            </div>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-slate-700 leading-relaxed">
            <p>
              The urgency score dictates department dispatch priorities and statutory SLA deadlines. It is calculated by adding points across four verified criteria:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="font-bold text-slate-900 block text-xs">1. Base Category Hazard (1 to 6 pts)</span>
                <p className="text-xs text-slate-500">
                  Major sewer breach = 4 pts. Broken arterial road = 3 pts. Uncollected street trash = 2 pts. Broken street light = 2 pts.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="font-bold text-slate-900 block text-xs">2. Weather Vulnerability (+1 to +2 pts)</span>
                <p className="text-xs text-slate-500">
                  If rain or severe weather is forecast within 48 hours for an open drain or damaged road, points are added to prevent flooding.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="font-bold text-slate-900 block text-xs">3. Sensitive Location (+1 to +2 pts)</span>
                <p className="text-xs text-slate-500">
                  Issues located within 250 meters of schools, hospitals, or transit hubs receive priority to protect vulnerable pedestrians.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-1">
                <span className="font-bold text-slate-900 block text-xs">4. Recurrence & Community Reports (+1 pt)</span>
                <p className="text-xs text-slate-500">
                  Repeated community reports or previous unresolved tickets in the same 50-meter cluster bump the priority.
                </p>
              </div>
            </div>

            {/* Plain-Language Worked Example */}
            <div className="mt-6 p-5 rounded-2xl bg-[#0B1E36] text-white space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                  Worked Real-World Example
                </span>
                <span className="bg-teal-500/20 text-teal-300 text-xs font-mono font-bold px-2 py-0.5 rounded-full border border-teal-400/30">
                  Final Urgency: 8 / 10
                </span>
              </div>
              <p className="text-xs text-slate-200">
                <strong>Complaint:</strong> &quot;Open drain about 1 meter wide overflowing with sewage near City High School.&quot;
              </p>
              <div className="bg-white/10 rounded-xl p-3 text-xs space-y-1 font-mono">
                <div className="flex justify-between">
                  <span>• Base Sewage overflow hazard</span>
                  <span className="text-teal-300">+4 pts</span>
                </div>
                <div className="flex justify-between">
                  <span>• Heavy rain forecast in 24 hours</span>
                  <span className="text-teal-300">+2 pts</span>
                </div>
                <div className="flex justify-between">
                  <span>• Sensitive zone (near City High School)</span>
                  <span className="text-teal-300">+1 pt</span>
                </div>
                <div className="flex justify-between">
                  <span>• 3 previous neighbor reports this week</span>
                  <span className="text-teal-300">+1 pt</span>
                </div>
                <div className="flex justify-between border-t border-white/20 pt-1 font-bold">
                  <span>Total Calculated Score</span>
                  <span className="text-teal-400">8 / 10 (SLA: 24 Hours)</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Privacy & Data Protection */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Privacy, Anonymity & Data Protection
              </h2>
              <p className="text-xs text-slate-500">
                How we handle your voice data, photos, and location.
              </p>
            </div>
          </div>

          <div className="text-xs sm:text-sm text-slate-600 leading-relaxed space-y-3">
            <p>
              <strong>1. Voice Recordings:</strong> Audio captured during voice intake is processed in real-time in your browser and on secure servers strictly for transcription. Audio recordings are never retained or sold.
            </p>
            <p>
              <strong>2. GPS & Photographs:</strong> Location coordinates and uploaded photos are solely utilized to navigate field workers to the repair site and to create verified before/after proof.
            </p>
            <p>
              <strong>3. Public Redaction:</strong> When complaints are viewed publicly via tracking links (e.g. `/track/CF-1042`), citizen names, phone numbers, and exact contact details are strictly hidden to preserve your privacy.
            </p>
          </div>
        </section>

        {/* Contact Form */}
        <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-[#0D7377] flex items-center justify-center font-bold">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Contact Municipal Ombudsman
              </h2>
              <p className="text-xs text-slate-500">
                Questions or feedback regarding city redressal policies.
              </p>
            </div>
          </div>

          {contactSubmitted ? (
            <div className="p-6 rounded-2xl bg-teal-50 border border-teal-200 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-[#0D7377] mx-auto" />
              <h4 className="font-bold text-sm text-slate-900">Message Received</h4>
              <p className="text-xs text-slate-600">
                Thank you for reaching out. A representative will respond to your inquiry shortly.
              </p>
            </div>
          ) : (
            <form onSubmit={handleContactSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Your Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                    placeholder="e.g. Tariq Khan"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Your Email</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500"
                    placeholder="e.g. tariq@gmail.com"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Message</label>
                <textarea
                  rows={4}
                  required
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 resize-none"
                  placeholder="Inquire about department coverage, suggest an improvement..."
                />
              </div>

              <button
                type="submit"
                className="bg-[#0D7377] hover:bg-[#095256] text-white text-xs font-bold py-3 px-6 rounded-xl transition-all flex items-center gap-2 shadow-sm"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Inquiries</span>
              </button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}
