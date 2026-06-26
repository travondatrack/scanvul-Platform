import { requireActiveUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { fetchBackend } from "@/lib/backend";
import { Activity, CheckCircle, XCircle, Server, Database, ShieldCheck } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function AdminHealthPage() {
  const user = await requireActiveUser();
  if (user.roleGlobal !== "admin") {
    notFound();
  }

  let health: any = null;
  let backendUp = false;
  try {
    health = await fetchBackend("health/engines");
    backendUp = true;
  } catch (e) {
    backendUp = false;
  }

  // Fetch some metrics from DB
  const totalScans = await prisma.scan.count();
  const queuedScans = await prisma.scan.count({ where: { status: "queued" } });
  const failedScans = await prisma.scan.count({ where: { status: "failed" } });
  const activeTokens = await prisma.apiToken.count({ where: { isActive: "true" } });

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
          <Activity className="w-8 h-8 text-[#00c9e8]" />
          System Health Dashboard
        </h1>
        <p className="text-slate-400 mt-1">Real-time status of backend services and engines.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Core Services */}
        <div className="bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-purple-400" />
            Core Services
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-slate-300 font-bold">FastAPI Backend</span>
              {backendUp ? (
                <span className="flex items-center gap-1 text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                  <CheckCircle className="w-4 h-4" /> Operational
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-400 text-sm font-bold bg-red-500/10 px-2 py-1 rounded border border-red-500/20">
                  <XCircle className="w-4 h-4" /> Down
                </span>
              )}
            </div>
            <div className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
              <span className="text-slate-300 font-bold">Primary Database</span>
              <span className="flex items-center gap-1 text-emerald-400 text-sm font-bold bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20">
                <CheckCircle className="w-4 h-4" /> Operational
              </span>
            </div>
          </div>
        </div>

        {/* Engine Status */}
        <div className="bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#00c9e8]" />
            Scanner Engines
          </h2>
          {health && health.engines ? (
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(health.engines).map(([engine, isAvail]) => (
                <div key={engine} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <span className="text-slate-300 font-bold capitalize">{engine}</span>
                  {isAvail ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-slate-400 text-sm p-4 bg-white/5 rounded-xl text-center">
              Backend is unreachable. Cannot fetch engine status.
            </div>
          )}
        </div>

        {/* Real-time Metrics */}
        <div className="bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl md:col-span-2">
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Database className="w-5 h-5 text-orange-400" />
            Platform Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-slate-400 text-xs font-bold uppercase">Total Scans</p>
              <p className="text-2xl font-extrabold text-white">{totalScans}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-slate-400 text-xs font-bold uppercase">Queue Depth</p>
              <p className="text-2xl font-extrabold text-orange-400">{queuedScans}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-slate-400 text-xs font-bold uppercase">Failed Scans</p>
              <p className="text-2xl font-extrabold text-red-400">{failedScans}</p>
            </div>
            <div className="p-4 bg-white/5 rounded-xl border border-white/10">
              <p className="text-slate-400 text-xs font-bold uppercase">Active API Tokens</p>
              <p className="text-2xl font-extrabold text-purple-400">{activeTokens}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
