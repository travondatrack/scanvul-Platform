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
        <div className="group bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-[#00c9e8]/30 hover:bg-[#0b1215]/95">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#cfe0ea] font-medium">Total Projects</h3>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#073144] to-[#0a839b] flex items-center justify-center shadow-[0_0_18px_rgba(0,196,224,0.22)] group-hover:scale-110 transition-transform">
              <FolderKanban className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-white">{totalProjects}</p>
        </div>

        <div className="group bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-[#00c9e8]/30 hover:bg-[#0b1215]/95">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#cfe0ea] font-medium">Total Scans</h3>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#073144] to-[#0a839b] flex items-center justify-center shadow-[0_0_18px_rgba(0,196,224,0.22)] group-hover:scale-110 transition-transform">
              <Activity className="w-5 h-5 text-white" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-white">{totalScans}</p>
        </div>

        <div className="group bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-red-500/30 hover:bg-[#0b1215]/95">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#cfe0ea] font-medium">Critical Risks</h3>
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(239,68,68,0.2)]">
              <ShieldAlert className="w-5 h-5 text-red-500" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">{criticalCount}</p>
        </div>

        <div className="group bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl transition-all hover:border-orange-500/30 hover:bg-[#0b1215]/95">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#cfe0ea] font-medium">High Risks</h3>
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20 group-hover:scale-110 transition-transform shadow-[0_0_15px_rgba(249,115,22,0.2)]">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
          </div>
          <p className="text-4xl font-extrabold text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]">{highCount}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <div className="bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-6">Active Vulnerabilities Breakdown</h2>
          
          <div className="space-y-6">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-red-400 font-medium">Critical</span>
                <span className="text-slate-400">{criticalCount}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]" style={{ width: `${criticalPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-orange-400 font-medium">High</span>
                <span className="text-slate-400">{highCount}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" style={{ width: `${highPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-amber-400 font-medium">Medium</span>
                <span className="text-slate-400">{mediumCount}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${mediumPct}%` }}></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-emerald-400 font-medium">Low</span>
                <span className="text-slate-400">{lowCount}</span>
              </div>
              <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]" style={{ width: `${lowPct}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
            <ShieldCheck className="w-10 h-10 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Platform Health</h2>
          <p className="text-[#cfe0ea] max-w-md">
            All SAST and Secret Scanning engines are online and protecting your codebases. 
            You have {totalActive} open findings across your repositories.
          </p>
          <Link href="/projects" className="mt-6 px-6 py-3 bg-gradient-to-b from-[#21dcf8] to-[#0797b9] hover:opacity-90 text-white rounded-xl transition-all duration-200 shadow-[0_0_22px_rgba(0,207,234,0.34)] active:scale-[0.98] text-sm font-bold">
            Manage Projects
          </Link>
        </div>
      </div>
    </div>
  );
}
