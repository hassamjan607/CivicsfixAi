"use client";

import React, { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  Sparkles, 
  User, 
  ShieldCheck, 
  Wrench, 
  Building2, 
  Loader2, 
  AlertCircle 
} from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState<string | null>(null);

  const isDemoMode = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Invalid email or password.");
        setIsLoading(false);
        return;
      }

      // Successful login
      const target = nextUrl || data.redirect || `/${data.user?.role || "citizen"}`;
      router.push(target);
      router.refresh();
    } catch (err) {
      setError("Unable to connect to server. Please try again.");
      setIsLoading(false);
    }
  };

  const handleDemoClick = async (role: "citizen" | "officer" | "worker" | "admin") => {
    setError(null);
    setDemoLoading(role);

    try {
      const res = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Demo login failed");
        setDemoLoading(null);
        return;
      }

      const target = nextUrl || data.redirect || `/${role}`;
      router.push(target);
      router.refresh();
    } catch (err) {
      setError("Demo login failed");
      setDemoLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1E36] via-[#0E2A4D] to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center space-x-2.5 group">
            <img
              src="/logo.jpg"
              alt="CivicFix AI Logo"
              className="w-10 h-10 rounded-xl object-cover border border-teal-500/30 shadow-md group-hover:scale-105 transition-transform"
            />
            <span className="text-2xl font-black text-white tracking-tight">
              CivicFix AI
            </span>
          </Link>
          <p className="text-xs text-slate-400">
            Sign in to access your role-specific municipal portal
          </p>
        </div>

        {/* Demo Mode Quick Access Pills */}
        {isDemoMode && (
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-teal-500/30 text-white space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Demo Mode: 1-Click Access</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">Password123!</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleDemoClick("citizen")}
                disabled={demoLoading !== null}
                className="bg-white/10 hover:bg-white/20 active:scale-95 text-white p-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2 text-xs font-semibold"
              >
                {demoLoading === "citizen" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <User className="w-3.5 h-3.5 text-teal-300" />
                )}
                <span>Citizen</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoClick("officer")}
                disabled={demoLoading !== null}
                className="bg-white/10 hover:bg-white/20 active:scale-95 text-white p-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2 text-xs font-semibold"
              >
                {demoLoading === "officer" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-300" />
                )}
                <span>Officer</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoClick("worker")}
                disabled={demoLoading !== null}
                className="bg-white/10 hover:bg-white/20 active:scale-95 text-white p-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2 text-xs font-semibold"
              >
                {demoLoading === "worker" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wrench className="w-3.5 h-3.5 text-amber-300" />
                )}
                <span>Worker</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoClick("admin")}
                disabled={demoLoading !== null}
                className="bg-white/10 hover:bg-white/20 active:scale-95 text-white p-2.5 rounded-xl border border-white/10 transition-all flex items-center gap-2 text-xs font-semibold"
              >
                {demoLoading === "admin" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                )}
                <span>City Admin</span>
              </button>
            </div>
          </div>
        )}

        {/* Real Sign-In Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200">
          <form onSubmit={handleLogin} className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Sign In
            </h2>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Email or Phone Number
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. citizen1@gmail.com or 0300-1234567"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 block">
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-[11px] text-[#0D7377] hover:underline font-semibold"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-[#0D7377] hover:bg-[#0A4D54] disabled:opacity-50 text-white font-extrabold py-3.5 px-4 rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center space-y-2">
            <p className="text-xs text-slate-500">
              Don&apos;t have an account yet?{" "}
              <Link href="/register" className="text-[#0D7377] font-bold hover:underline">
                Register as Citizen
              </Link>
            </p>
            <p className="text-[11px] text-slate-400">
              Want to check a ticket anonymously?{" "}
              <Link href="/track" className="text-slate-600 font-semibold hover:underline">
                Track by ID
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
