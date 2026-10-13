"use client";

import React from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">System Error</h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          An unexpected error occurred while processing this request. Our technical staff has been logged.
        </p>
        <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
          <button
            onClick={() => reset()}
            className="bg-[#0D7377] text-white text-xs font-bold py-3 px-6 rounded-xl hover:bg-[#095256] transition-all flex items-center justify-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
          <Link
            href="/"
            className="bg-slate-100 text-slate-700 text-xs font-bold py-3 px-6 rounded-xl hover:bg-slate-200 transition-all text-center"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
