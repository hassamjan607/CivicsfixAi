import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-slate-900">403 - Access Denied</h1>
        <p className="text-xs text-slate-600 leading-relaxed">
          Your current session does not have permission to view this department or role workspace.
        </p>
        <div className="pt-4 flex flex-col sm:flex-row gap-2 justify-center">
          <Link
            href="/login"
            className="bg-[#0D7377] text-white text-xs font-bold py-3 px-6 rounded-xl hover:bg-[#095256] transition-all"
          >
            Sign In with Another Account
          </Link>
          <Link
            href="/"
            className="bg-slate-100 text-slate-700 text-xs font-bold py-3 px-6 rounded-xl hover:bg-slate-200 transition-all"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
