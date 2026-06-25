import { prisma } from "@/lib/prisma";
import { FindingsPanel } from "@/components/ui/findings-panel";
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ScanResultPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await Promise.resolve(params);

  const scan = await prisma.scan.findUnique({
    where: { id: resolvedParams.id },
    include: { findings: { orderBy: { createdAt: "desc" } } }
  });

  if (!scan) notFound();

  const critical = scan.findings.filter(f => f.severity === "critical" || f.severity === "Critical").length;
  const high = scan.findings.filter(f => f.severity === "high" || f.severity === "High").length;
  const medium = scan.findings.filter(f => f.severity === "medium" || f.severity === "Medium").length;
  const low = scan.findings.filter(f => f.severity === "low" || f.severity === "Low").length;

  // Normalize findings for FindingsPanel
  const panelFindings = scan.findings.map((f, idx) => ({
    id: idx,
    severity: f.severity,
    ruleId: f.ruleId ?? "",
    scanCategory: f.scanCategory ?? "SAST source code",
    engine: f.engine,
    title: f.title,
    filePath: f.filePath,
    lineNumber: f.lineNumber,
    lineStart: f.lineStart ?? f.lineNumber,
    lineEnd: f.lineEnd ?? f.lineNumber,
    source: f.source ?? "",
    sink: f.sink ?? "",
    functionName: f.functionName ?? "",
    whyVulnerable: f.whyVulnerable ?? "",
    attackScenario: f.attackScenario ?? "",
    impact: f.impact ?? "",
    remediation: f.remediation ?? "",
    poc: f.poc ?? "",
    codeSnippet: f.codeSnippet ?? "",
    evidence: f.evidence ?? "",
    pentestHint: f.pentestHint ?? "",
    references: f.extReferences ?? "",
    cvss4: f.cvss4Score,
    confidence: f.confidence,
    verificationStatus: f.verificationStatus ?? "unverified",
    dedupeHash: f.dedupeHash ?? "",
    dataflowTrace: f.dataflowTrace ?? "",
    vulnType: f.vulnType ?? "",
    cweId: f.cweId ?? "",
    owaspCategory: f.owaspCategory ?? "",
  }));

  const isRunning = scan.status === "queued" || scan.status === "running";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-slate-900 dark:text-white font-sans transition-colors duration-300">
      <div className="max-w-7xl mx-auto p-6 space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 dark:border-zinc-800/50 pb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/reports" className="text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-300 text-sm transition-colors">
                ← Reports
              </Link>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Scan Report</h1>
            <p className="text-slate-500 dark:text-zinc-500 font-mono text-xs mt-1">{scan.id}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Status badge */}
            <div className={`px-4 py-2 rounded-full font-medium flex items-center gap-2 text-sm ${
              scan.status === "completed" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20" :
              scan.status === "failed" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-500/20" :
              "bg-brand/10 dark:bg-brand/20 text-brand border border-brand/20 dark:border-brand/30 animate-pulse"
            }`}>
              {scan.status === "completed" && <CheckCircle className="w-4 h-4" />}
              {scan.status === "failed" && <AlertTriangle className="w-4 h-4" />}
              {isRunning && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span className="capitalize">{scan.status}</span>
            </div>
            {isRunning && (
              <a href={`/scan/${scan.id}`}
                className="bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 hover:bg-slate-50 dark:hover:bg-zinc-700 text-slate-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Refresh
              </a>
            )}
          </div>
        </div>

        {/* Overview grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
            <p className="text-slate-500 dark:text-zinc-400 text-xs font-medium mb-1">Target</p>
            <p className="font-semibold truncate text-sm text-slate-900 dark:text-white" title={scan.sourceValue}>
              {(scan.sourceType === "repo_url" || scan.sourceType === "github")
                ? scan.sourceValue
                : "Code Snippet"}
            </p>
          </div>
          <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
            <p className="text-slate-500 dark:text-zinc-400 text-xs font-medium mb-1">Risk Level</p>
            <div className={`text-2xl font-bold ${
              scan.riskLevel === "Critical" ? "text-red-600 dark:text-red-400" :
              scan.riskLevel === "High" ? "text-orange-600 dark:text-orange-400" :
              scan.riskLevel === "Medium" ? "text-amber-600 dark:text-amber-400" :
              scan.riskLevel === "Low" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400 dark:text-zinc-500"
            }`}>
              {scan.riskLevel}
            </div>
            <p className="text-slate-500 dark:text-zinc-500 text-xs mt-1">{scan.riskPercent?.toFixed(1)}% risk score</p>
          </div>
          <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
            <p className="text-slate-500 dark:text-zinc-400 text-xs font-medium mb-1">Total Findings</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{scan.findings.length}</p>
          </div>
          <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-5 shadow-sm dark:shadow-xl dark:backdrop-blur-xl">
            <p className="text-slate-500 dark:text-zinc-400 text-xs font-medium mb-1">Scanned At</p>
            <p className="text-sm font-medium text-slate-700 dark:text-zinc-300">
              {new Date(scan.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Severity breakdown */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Critical", count: critical, color: "bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400", num: "text-red-600 dark:text-red-400" },
            { label: "High", count: high, color: "bg-orange-50 dark:bg-orange-500/10 border-orange-100 dark:border-orange-500/20 text-orange-700 dark:text-orange-400", num: "text-orange-600 dark:text-orange-400" },
            { label: "Medium", count: medium, color: "bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400", num: "text-amber-600 dark:text-amber-400" },
            { label: "Low", count: low, color: "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400", num: "text-emerald-600 dark:text-emerald-400" },
          ].map(({ label, count, color, num }) => (
            <div key={label} className={`border rounded-xl p-4 flex items-center justify-between ${color}`}>
              <span className="font-semibold text-sm">{label}</span>
              <span className={`text-2xl font-bold ${num}`}>{count}</span>
            </div>
          ))}
        </div>

        {/* Findings */}
        <div>
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-slate-900 dark:text-white">
            <Search className="w-5 h-5 text-brand" />
            <span>Vulnerability Details</span>
            {scan.findings.length > 0 && (
              <span className="text-sm font-normal text-slate-500 dark:text-zinc-400">({scan.findings.length} total)</span>
            )}
          </h2>

          {scan.findings.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900/50 shadow-sm dark:shadow-xl dark:backdrop-blur-xl border border-slate-200 dark:border-zinc-800/50 rounded-2xl p-12 text-center">
              {scan.status === "completed" ? (
                <>
                  <ShieldCheck className="w-16 h-16 text-emerald-500 dark:text-emerald-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">No Vulnerabilities Found!</h3>
                  <p className="text-slate-500 dark:text-zinc-400 mt-2">Your code looks clean. Great job!</p>
                </>
              ) : scan.status === "failed" ? (
                <>
                  <AlertTriangle className="w-16 h-16 text-red-500 dark:text-red-400 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Scan Failed</h3>
                  <p className="text-slate-500 dark:text-zinc-400 mt-2">The scan encountered an error. Please try again.</p>
                </>
              ) : (
                <>
                  <Activity className="w-16 h-16 text-brand mx-auto mb-4 animate-pulse" />
                  <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Scan In Progress...</h3>
                  <p className="text-slate-500 dark:text-zinc-400 mt-2">Results will appear here when the scan completes.</p>
                  <a href={`/scan/${scan.id}`}
                    className="mt-4 inline-block bg-brand hover:opacity-90 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors">
                    Refresh Page
                  </a>
                </>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900/50 shadow-sm dark:shadow-xl dark:backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-zinc-800/50 p-4">
              <FindingsPanel findings={panelFindings} />
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
