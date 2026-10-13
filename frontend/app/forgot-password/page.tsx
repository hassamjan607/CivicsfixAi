"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Mail, Send, CheckCircle2, AlertCircle } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      setSubmitted(true);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1E36] via-[#0E2A4D] to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-black text-sm">
              CF
            </div>
            <span className="text-2xl font-black text-white tracking-tight">
              CivicFix AI
            </span>
          </Link>
          <p className="text-xs text-slate-400">
            Reset access to your municipal account
          </p>
        </div>

        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200">
          {submitted ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-[#0D7377] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Reset Link Sent</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                If an account exists for <strong className="text-slate-800">{email}</strong>, a password reset email has been dispatched with instructions.
              </p>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D7377] hover:underline"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Sign In</span>
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                Forgot Password
              </h2>
              <p className="text-xs text-slate-500">
                Enter your registered email address and we&apos;ll send you a secure link to reset your password.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. citizen1@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all font-medium text-slate-800"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#0D7377] hover:bg-[#0A4D54] disabled:opacity-50 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isLoading ? "Sending..." : "Send Reset Link"}</span>
              </button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Back to Sign In
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
