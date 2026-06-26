import { prisma } from "@/lib/prisma";
import { accessibleProjectWhere, accessibleScanWhere } from "@/lib/access";
import { requireActiveUser } from "@/lib/session";
import { LayoutDashboard, FolderKanban, ShieldAlert, Activity, AlertTriangle, ShieldCheck } from "lucide-react";
import Link from "next/link";

export default async function DashboardOverviewPage() {
  const user = await requireActiveUser();

  // Fetch aggregate stats
  const totalProjects = await prisma.project.count({
    where: user.roleGlobal === "admin" ? undefined : accessibleProjectWhere(user.id, "view"),
  });
  
  const totalScans = await prisma.scan.count({
    where: user.roleGlobal === "admin" ? undefined : accessibleScanWhere(user.id, "view"),
  });

  const findings = await prisma.finding.findMany({
    where: {
      scan: user.roleGlobal === "admin" ? undefined : accessibleScanWhere(user.id, "view"),
    },
    select: { severity: true, status: true }
  });

  const activeFindings = findings.filter(f => f.status !== "false_positive" && f.status !== "fixed");
  
  const criticalCount = activeFindings.filter(f => f.severity === "Critical").length;
  const highCount = activeFindings.filter(f => f.severity === "High").length;
  const mediumCount = activeFindings.filter(f => f.severity === "Medium").length;
  const lowCount = activeFindings.filter(f => f.severity === "Low").length;

  const totalActive = activeFindings.length;
  
  // Calculate percentages for the progress bars
  const criticalPct = totalActive > 0 ? (criticalCount / totalActive) * 100 : 0;
  const highPct = totalActive > 0 ? (highCount / totalActive) * 100 : 0;
  const mediumPct = totalActive > 0 ? (mediumCount / totalActive) * 100 : 0;
  const lowPct = totalActive > 0 ? (lowCount / totalActive) * 100 : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">High-level metrics across all your secure code repositories.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 dark:text-zinc-400 font-medium">Total Projects</h3>
            <div className="w-10 h-10 rounded-xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center">
              <FolderKanban className="w-5 h-5 text-brand" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-900 dark:text-white">{totalProjects}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 dark:text-zinc-400 font-medium">Total Scans</h3>
            <div className="w-10 h-10 rounded-xl bg-brand/10 dark:bg-brand/20 flex items-center justify-center">
              <Activity className="w-5 h-5 text-brand" />
            </div>
          </div>
          <p className="text-4xl font-bold text-slate-900 dark:text-white">{totalScans}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 dark:text-zinc-400 font-medium">Critical Risks</h3>
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-red-600 dark:text-red-400">{criticalCount}</p>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-500 dark:text-zinc-400 font-medium">High Risks</h3>
            <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-500/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-4xl font-bold text-orange-600 dark:text-orange-400">{highCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">Active Vulnerabilities Breakdown</h2>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-600 dark:text-red-400 font-medium">Critical</span>
                <span className="text-slate-500 dark:text-zinc-400">{criticalCount}</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 dark:bg-red-500/80 rounded-full" style={{ width: `${criticalPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-orange-600 dark:text-orange-400 font-medium">High</span>
                <span className="text-slate-500 dark:text-zinc-400">{highCount}</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 dark:bg-orange-500/80 rounded-full" style={{ width: `${highPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-amber-600 dark:text-yellow-400 font-medium">Medium</span>
                <span className="text-slate-500 dark:text-zinc-400">{mediumCount}</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 dark:bg-yellow-500/80 rounded-full" style={{ width: `${mediumPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">Low</span>
                <span className="text-slate-500 dark:text-zinc-400">{lowCount}</span>
              </div>
              <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 dark:bg-emerald-500/80 rounded-full" style={{ width: `${lowPct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-6 shadow-sm dark:shadow-xl dark:backdrop-blur-xl flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-emerald-50 dark:bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="w-10 h-10 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Platform Health</h2>
          <p className="text-slate-500 dark:text-zinc-400 max-w-md">
            All SAST and Secret Scanning engines are online and protecting your codebases. 
            You have {totalActive} open findings across your repositories.
          </p>
          <Link href="/projects" className="mt-6 px-6 py-2.5 bg-brand hover:opacity-90 text-white rounded-xl transition-colors text-sm font-medium">
            Manage Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
