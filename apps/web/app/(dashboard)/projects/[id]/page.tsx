import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Plus, RefreshCw, AlertTriangle, Clock, Search, FolderKanban } from "lucide-react";
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
          <h1 className="text-3xl font-bold text-white tracking-tight">{project.name}</h1>
          <p className="text-zinc-400 mt-1 flex items-center space-x-2">
            <FolderKanban className="w-4 h-4" />
            <span>{project.repoUrl || "No Repository linked"}</span>
          </p>
        </div>
        <TriggerScanButton projectId={project.id} repoUrl={project.repoUrl || ""} />
      </div>

      <div className="bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-xl rounded-2xl p-6">
        <h2 className="text-xl font-bold mb-4 flex items-center space-x-2">
          <Clock className="w-5 h-5 text-blue-400" />
          <span>Scan History</span>
        </h2>

        {project.scans.length === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400">No scans have been executed for this project yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {project.scans.map(scan => (
              <Link key={scan.id} href={`/scan/${scan.id}`} className="block">
                <div className="flex items-center justify-between p-4 bg-zinc-950/50 border border-zinc-800/50 hover:border-zinc-600 rounded-xl transition-colors group">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      scan.status === "completed" ? "bg-emerald-500/10 text-emerald-400" :
                      scan.status === "failed" ? "bg-red-500/10 text-red-400" :
                      "bg-blue-500/10 text-blue-400"
                    }`}>
                      {scan.status === "completed" && <ShieldCheck className="w-5 h-5" />}
                      {scan.status === "failed" && <AlertTriangle className="w-5 h-5" />}
                      {(scan.status === "queued" || scan.status === "running") && <RefreshCw className="w-5 h-5 animate-spin" />}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
                        Scan {scan.id.split("-")[0]}...
                      </h4>
                      <p className="text-xs text-zinc-500">{new Date(scan.createdAt).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Risk Level</p>
                      <p className={`font-semibold ${
                        scan.riskLevel === "Critical" ? "text-red-500" :
                        scan.riskLevel === "High" ? "text-orange-500" :
                        scan.riskLevel === "Low" ? "text-emerald-500" : "text-zinc-300"
                      }`}>{scan.riskLevel || "Unknown"}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-500">Status</p>
                      <p className="font-semibold text-white capitalize">{scan.status}</p>
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
