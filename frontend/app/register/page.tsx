"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  User, 
  Mail, 
  Phone, 
  Lock, 
  Globe, 
  ArrowRight, 
  Loader2, 
  AlertCircle,
  CheckCircle2
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    language: "en",
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Registration failed. Please check your details.");
        setIsLoading(false);
        return;
      }

      // Auto logged in upon registration
      router.push("/citizen");
      router.refresh();
    } catch (err) {
      setError("Server connection failed. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0B1E36] via-[#0E2A4D] to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
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
            Create your citizen account to track complaints and confirm fixes
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200">
          <form onSubmit={handleRegister} className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Create Citizen Account
            </h2>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Hassam Jan"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="email"
                  required
                  placeholder="e.g. hassam@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Phone Number (Optional)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="tel"
                  placeholder="e.g. 0300-1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="w-full text-xs pl-10 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 transition-all font-medium text-slate-800"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Preferred Interface Language
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, language: "en" })}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    formData.language === "en"
                      ? "border-teal-600 bg-teal-50 text-[#0D7377]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, language: "ur" })}
                  className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                    formData.language === "ur"
                      ? "border-teal-600 bg-teal-50 text-[#0D7377]"
                      : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  اردو (Urdu)
                </button>
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
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <span>Register & Open Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Already have an account?{" "}
              <Link href="/login" className="text-[#0D7377] font-bold hover:underline">
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
