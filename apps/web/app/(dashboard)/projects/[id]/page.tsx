import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, RefreshCw, AlertTriangle, Clock, FolderKanban } from "lucide-react";
import TriggerScanButton from "../../../../components/TriggerScanButton"; // We'll create this component next

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  
  if (!session || !(session.user as any).id) {
    return <div>Unauthorized</div>;
  }

  const resolvedParams = await Promise.resolve(params);

  const project = await prisma.project.findUnique({
    where: { id: resolvedParams.id },
    include: {
      scans: {
        orderBy: { createdAt: "desc" }
      }
    }
  });

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">{project.name}</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 flex items-center space-x-2">
            <FolderKanban className="w-4 h-4" />
            <span>{project.repoUrl || "No Repository linked"}</span>
          </p>
        </div>
        <TriggerScanButton projectId={project.id} repoUrl={project.repoUrl || ""} />
      </div>

      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 dark:backdrop-blur-xl rounded-2xl p-6 shadow-sm dark:shadow-xl">
        <h2 className="text-xl font-bold mb-4 flex items-center space-x-2 text-slate-900 dark:text-white">
          <Clock className="w-5 h-5 text-brand" />
          <span>Scan History</span>
        </h2>

        {project.scans.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 text-slate-300 dark:text-zinc-600 mx-auto mb-3" />
            <p className="text-slate-500 dark:text-zinc-400">No scans have been executed for this project yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {project.scans.map(scan => (
              <Link key={scan.id} href={`/scan/${scan.id}`} className="block">
                <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-950/50 border border-slate-200 dark:border-zinc-800/50 hover:border-brand/40 dark:hover:border-brand/40 rounded-xl transition-colors group">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      scan.status === "completed" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" :
                      scan.status === "failed" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" :
                      "bg-brand/10 dark:bg-brand/20 text-brand"
                    }`}>
                      {scan.status === "completed" && <ShieldCheck className="w-5 h-5" />}
                      {scan.status === "failed" && <AlertTriangle className="w-5 h-5" />}
                      {(scan.status === "queued" || scan.status === "running") && <RefreshCw className="w-5 h-5 animate-spin" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 dark:text-white group-hover:text-brand transition-colors">
                        Scan {scan.id.split("-")[0]}...
                      </h4>
                      <p className="text-xs text-slate-500 dark:text-zinc-500">{new Date(scan.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-zinc-500">Risk Level</p>
                      <p className={`font-semibold ${
                        scan.riskLevel === "Critical" ? "text-red-600 dark:text-red-400" :
                        scan.riskLevel === "High" ? "text-orange-600 dark:text-orange-400" :
                        scan.riskLevel === "Low" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-zinc-300"
                      }`}>{scan.riskLevel || "Unknown"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-zinc-500">Status</p>
                      <p className="font-semibold text-slate-900 dark:text-white capitalize">{scan.status}</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
