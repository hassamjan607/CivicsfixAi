import Link from "next/link";
import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
          <WifiOff className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">You Are Offline</h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          It looks like your internet connection is down. Don&apos;t worry—any voice reports or field photos you capture offline will be safely queued and synced once your connection returns.
        </p>
        <div className="pt-4 flex justify-center">
          <Link
            href="/"
            className="bg-[#0D7377] text-white text-xs font-bold py-3 px-6 rounded-xl hover:bg-[#095256] transition-all flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Check Connection & Retry</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
