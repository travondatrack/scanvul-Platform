import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="w-full h-[60vh] flex flex-col items-center justify-center animate-fade-in">
      <div className="relative">
        <div className="absolute inset-0 blur-xl bg-brand/20 dark:bg-brand/10 rounded-full animate-pulse" />
        <div className="w-16 h-16 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 shadow-sm rounded-2xl flex items-center justify-center relative z-10">
          <Loader2 className="w-8 h-8 text-brand animate-spin" />
        </div>
      </div>
      <p className="mt-4 font-medium text-slate-500 dark:text-zinc-400 animate-pulse">Loading data...</p>
    </div>
  );
}
