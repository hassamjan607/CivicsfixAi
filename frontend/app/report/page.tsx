"use client";

import CitizenSubmissionScreen from "../../components/citizen/CitizenSubmissionScreen";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function ReportPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#EEF2F6] flex flex-col items-center justify-center p-0 sm:p-4 md:p-6">
      <div className="w-full max-w-6xl mb-3 px-4 hidden sm:flex items-center justify-between">
        <Link 
          href="/" 
          className="text-xs font-semibold text-[#0D5C63] hover:underline flex items-center gap-1"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Interactive Switcher Home</span>
        </Link>
        <span className="text-xs font-bold text-slate-500">Page 1: Citizen Submission</span>
      </div>
      <CitizenSubmissionScreen 
        onNavigateToReceived={() => router.push("/received")}
        isWideView={true}
      />
    </div>
  );
}
