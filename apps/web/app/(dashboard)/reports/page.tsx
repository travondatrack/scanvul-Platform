import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../lib/auth";
import { ShieldCheck, AlertTriangle, RefreshCw, FileText, ChevronRight, Search, Filter, ShieldAlert, ArrowRight, Download } from "lucide-react";
import Link from "next/link";

export default async function ReportsPage() {
  const session = await getServerSession(authOptions);
  
  if (!session || !(session.user as any).id) {
    return <div>Unauthorized</div>;
  }

  const userId = (session.user as any).id;

  const scans = await prisma.scan.findMany({
    where: { project: { createdBy: userId } },
    include: {
      project: true,
      findings: {
        select: { severity: true }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Scans & Reports</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1">A consolidated view of all scan executions across your projects.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl overflow-hidden shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
        <div className="p-6 border-b border-slate-200 dark:border-zinc-800/50 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-brand" />
            <span>All Scans</span>
          </h2>
        </div>

        {scans.length === 0 ? (
          <div className="p-12 text-center">
            <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">No scans found</h3>
            <p className="text-slate-500 dark:text-zinc-400">Trigger a scan from your projects to see reports here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 dark:bg-zinc-950/50 text-xs uppercase tracking-wider text-slate-500 dark:text-zinc-500 font-semibold">
                  <th className="p-4 border-b border-slate-200 dark:border-zinc-800/50">Scan ID</th>
                  <th className="p-4 border-b border-slate-200 dark:border-zinc-800/50">Project</th>
                  <th className="p-4 border-b border-slate-200 dark:border-zinc-800/50">Status</th>
                  <th className="p-4 border-b border-slate-200 dark:border-zinc-800/50">Risk Level</th>
                  <th className="p-4 border-b border-slate-200 dark:border-zinc-800/50">Findings</th>
                  <th className="p-4 border-b border-slate-200 dark:border-zinc-800/50">Date</th>
                  <th className="p-4 border-b border-slate-200 dark:border-zinc-800/50"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/50">
                {scans.map((scan) => {
                  const critical = scan.findings.filter(f => f.severity === "Critical").length;
                  const high = scan.findings.filter(f => f.severity === "High").length;
                  const total = scan.findings.length;

                  return (
                    <tr key={scan.id} className="hover:bg-slate-50 dark:hover:bg-zinc-800/30 transition-colors group">
                      <td className="p-4 text-sm font-medium text-slate-900 dark:text-white truncate max-w-[120px]">
                        {scan.id.split("-")[0]}
                      </td>
                      <td className="p-4 text-sm text-slate-700 dark:text-zinc-300 font-medium">
                        {scan.project?.name || "Unknown Project"}
                      </td>
                      <td className="p-4">
                        <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                          scan.status === "completed" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                          scan.status === "failed" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" :
                          "bg-brand/10 text-brand"
                        }`}>
                          {scan.status === "completed" && <ShieldCheck className="w-3 h-3" />}
                          {scan.status === "failed" && <AlertTriangle className="w-3 h-3" />}
                          {(scan.status === "queued" || scan.status === "running") && <RefreshCw className="w-3 h-3 animate-spin" />}
                          <span>{scan.status}</span>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`text-sm font-semibold ${
                          scan.riskLevel === "Critical" ? "text-red-600 dark:text-red-400" :
                          scan.riskLevel === "High" ? "text-orange-600 dark:text-orange-400" :
                          scan.riskLevel === "Low" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-zinc-400"
                        }`}>
                          {scan.riskLevel || "-"}
                        </span>
                      </td>
                      <td className="p-4 text-sm">
                        <div className="flex items-center space-x-3">
                          <span className="text-slate-900 dark:text-zinc-300 font-medium">{total}</span>
                          {(critical > 0 || high > 0) && (
                            <div className="flex space-x-2 text-xs">
                              {critical > 0 && <span className="text-red-600 dark:text-red-400">{critical} C</span>}
                              {high > 0 && <span className="text-orange-600 dark:text-orange-400">{high} H</span>}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-sm text-slate-500 dark:text-zinc-400">
                        {new Date(scan.createdAt).toLocaleString()}
                      </td>
                      <td className="p-4 text-right">
                        <Link 
                          href={`/scan/${scan.id}`}
                          className="inline-flex items-center space-x-1 text-sm font-medium text-brand hover:opacity-80 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <span>View</span>
                          <ChevronRight className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
