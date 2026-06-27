import { prisma } from "@/lib/prisma";
import { requireScanAccess } from "@/lib/access";
import { requireActiveUser } from "@/lib/session";
import { FindingsPanel } from "@/components/ui/findings-panel";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { ScanActions } from "@/components/ui/scan-actions";
import { ScanTimeline } from "@/components/ui/scan-timeline";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ScanResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireActiveUser();
  const resolvedParams = await Promise.resolve(params);
  try {
    await requireScanAccess(user.id, resolvedParams.id, "view");
  } catch {
    notFound();
  }

  const scan = await prisma.scan.findUnique({
    where: { id: resolvedParams.id },
    include: { 
      findings: { orderBy: { createdAt: "desc" } },
      badges: { where: { isActive: "true" }, take: 1 },
      scanEvents: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!scan) notFound();

  const critical = scan.findings.filter(f => f.severity === "critical" || f.severity === "Critical").length;
  const high = scan.findings.filter(f => f.severity === "high" || f.severity === "High").length;
  const medium = scan.findings.filter(f => f.severity === "medium" || f.severity === "Medium").length;
  const low = scan.findings.filter(f => f.severity === "low" || f.severity === "Low").length;

  // Normalize findings for FindingsPanel
  const panelFindings = scan.findings.map((f) => ({
    id: f.id,
    status: f.status,
    assigneeId: f.assigneeId ?? undefined,
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
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300 relative">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,201,232,0.1),transparent_40%)]" />
      <div className="max-w-7xl mx-auto p-6 space-y-6 relative z-10">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-border pb-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Link
                href={`/projects/${scan.projectId || ""}`}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/50 text-muted-foreground shadow-sm backdrop-blur-xl transition-all hover:bg-muted hover:text-foreground hover:shadow-md"
                aria-label="Back to project"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="text-sm font-semibold text-muted-foreground">Project</span>
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground drop-shadow-[0_2px_10px_rgba(0,0,0,0.25)]">Scan Report</h1>
            <p className="text-muted-foreground/70 font-mono text-xs mt-1">{scan.id}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Status badge */}
            <div className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 text-sm shadow-[0_0_15px_rgba(0,0,0,0.2)] ${
              scan.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]" :
              scan.status === "failed" ? "bg-red-500/10 text-red-400 border border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]" :
              "bg-[hsl(var(--brand))]/10 text-brand border border-[hsl(var(--brand))]/20 shadow-[0_0_15px_rgba(0,201,232,0.15)] animate-pulse"
            }`}>
              {scan.status === "completed" && <CheckCircle className="w-4 h-4" />}
              {scan.status === "failed" && <AlertTriangle className="w-4 h-4" />}
              {isRunning && <RefreshCw className="w-4 h-4 animate-spin" />}
              <span className="capitalize">{scan.status}</span>
            </div>
            {isRunning && (
              <a href={`/scan/${scan.id}`}
                className="bg-muted/40 border border-border hover:bg-muted text-foreground px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-[0_0_15px_rgba(0,0,0,0.1)]">
                Refresh
              </a>
            )}
          </div>
        </div>

        {/* Overview grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 dark:border-white/5 rounded-2xl p-5 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(0,201,232,0.1)] transition-all duration-300">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Target</p>
            <p className="font-bold truncate text-sm text-foreground" title={scan.sourceValue}>
              {(scan.sourceType === "repo_url" || scan.sourceType === "github")
                ? scan.sourceValue
                : "Code Snippet"}
            </p>
          </div>
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 dark:border-white/5 rounded-2xl p-5 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(0,201,232,0.1)] transition-all duration-300">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Risk Level</p>
            <div className={`text-2xl font-extrabold bg-clip-text text-transparent bg-gradient-to-br ${
              scan.riskLevel === "Critical" ? "from-rose-600 to-red-800 dark:from-rose-400 dark:to-red-600 dark:drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]" :
              scan.riskLevel === "High" ? "from-orange-500 to-orange-700 dark:from-orange-400 dark:to-orange-600 dark:drop-shadow-[0_0_10px_rgba(249,115,22,0.4)]" :
              scan.riskLevel === "Medium" ? "from-amber-500 to-amber-700 dark:from-amber-400 dark:to-amber-600 dark:drop-shadow-[0_0_10px_rgba(245,158,11,0.4)]" :
              scan.riskLevel === "Low" ? "from-emerald-600 to-emerald-800 dark:from-emerald-400 dark:to-emerald-600 dark:drop-shadow-[0_0_10px_rgba(16,185,129,0.4)]" : "from-slate-500 to-slate-700 dark:from-slate-400 dark:to-slate-500"
            }`}>
              {scan.riskLevel}
            </div>
            <p className="text-slate-500 dark:text-muted-foreground/70 text-xs mt-1 font-medium">{scan.riskPercent?.toFixed(1)}% risk score</p>
          </div>
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 dark:border-white/5 rounded-2xl p-5 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(0,201,232,0.1)] transition-all duration-300">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Total Findings</p>
            <p className="text-3xl font-extrabold text-foreground">{scan.findings.length}</p>
          </div>
          <div className="bg-card/80 dark:bg-card/40 backdrop-blur-xl border border-border/50 dark:border-white/5 rounded-2xl p-5 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:hover:shadow-[0_8px_30px_rgba(0,201,232,0.1)] transition-all duration-300">
            <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Scanned At</p>
            <p className="text-sm font-bold text-foreground">
              {new Date(scan.createdAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Severity breakdown */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Critical", count: critical, color: "bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-500/10 dark:to-red-900/5 border-rose-200 dark:border-rose-500/30 hover:border-rose-300 dark:hover:border-rose-500/50 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]", num: "text-rose-600 dark:text-rose-500 dark:drop-shadow-[0_0_10px_rgba(244,63,94,0.6)]", iconCol: "text-rose-600 dark:text-rose-500 bg-rose-100 dark:bg-rose-500/20 border-rose-200 dark:border-rose-500/30" },
            { label: "High", count: high, color: "bg-gradient-to-br from-orange-50 to-orange-100/50 dark:from-orange-500/10 dark:to-orange-900/5 border-orange-200 dark:border-orange-500/30 hover:border-orange-300 dark:hover:border-orange-500/50 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(249,115,22,0.15)]", num: "text-orange-600 dark:text-orange-500 dark:drop-shadow-[0_0_10px_rgba(249,115,22,0.6)]", iconCol: "text-orange-600 dark:text-orange-500 bg-orange-100 dark:bg-orange-500/20 border-orange-200 dark:border-orange-500/30" },
            { label: "Medium", count: medium, color: "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-500/10 dark:to-amber-900/5 border-amber-200 dark:border-amber-500/30 hover:border-amber-300 dark:hover:border-amber-500/50 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]", num: "text-amber-600 dark:text-amber-500 dark:drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]", iconCol: "text-amber-600 dark:text-amber-500 bg-amber-100 dark:bg-amber-500/20 border-amber-200 dark:border-amber-500/30" },
            { label: "Low", count: low, color: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-500/10 dark:to-emerald-900/5 border-emerald-200 dark:border-emerald-500/30 hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-md dark:hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]", num: "text-emerald-600 dark:text-emerald-500 dark:drop-shadow-[0_0_10px_rgba(16,185,129,0.6)]", iconCol: "text-emerald-600 dark:text-emerald-500 bg-emerald-100 dark:bg-emerald-500/20 border-emerald-200 dark:border-emerald-500/30" },
          ].map(({ label, count, color, num, iconCol }) => (
            <div key={label} className={`border rounded-2xl p-5 flex items-center justify-between backdrop-blur-md transition-all duration-300 ${color}`}>
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border shadow-inner ${iconCol}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <span className="font-bold text-sm text-foreground">{label}</span>
              </div>
              <span className={`text-2xl font-extrabold ${num}`}>{count}</span>
            </div>
          ))}
        </div>

        {/* Scan Timeline & Findings */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1">
            <ScanTimeline events={scan.scanEvents} />
          </div>
          
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2 text-foreground">
                <Search className="w-5 h-5 text-brand" />
                <span>Vulnerability Details</span>
                {scan.findings.length > 0 && (
                  <span className="text-sm font-medium text-slate-400">({scan.findings.length} total)</span>
                )}
              </h2>
              
              {scan.status === "completed" && (
                <ScanActions 
                  scanId={scan.id} 
                  initialBadgeUrl={scan.badges[0] ? `/api/public/badge/${scan.badges[0].token}` : null} 
                />
              )}
            </div>

            {scan.findings.length === 0 ? (
              <div className="bg-card text-card-foreground shadow-sm border border-border rounded-xl p-12 text-center">
                {scan.status === "completed" ? (
                  <>
                    <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                    <h3 className="text-xl font-bold text-foreground">No Vulnerabilities Found!</h3>
                    <p className="text-muted-foreground mt-2">Your code looks clean. Great job!</p>
                  </>
                ) : scan.status === "failed" ? (
                  <>
                    <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                    <h3 className="text-xl font-bold text-foreground">Scan Failed</h3>
                    <p className="text-muted-foreground mt-2">The scan encountered an error. Please try again.</p>
                  </>
                ) : (
                  <>
                    <Activity className="w-16 h-16 text-brand mx-auto mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(0,201,232,0.5)]" />
                    <h3 className="text-xl font-bold text-foreground">Scan In Progress...</h3>
                    <p className="text-muted-foreground mt-2">Results will appear here when the scan completes.</p>
                    <a href={`/scan/${scan.id}`}
                      className="mt-6 inline-block bg-gradient-to-b from-[#21dcf8] to-[#0797b9] hover:opacity-90 text-foreground px-6 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(0,207,234,0.3)] transition-all">
                      Refresh Page
                    </a>
                  </>
                )}
              </div>
            ) : (
              <div className="bg-transparent">
                <FindingsPanel findings={panelFindings} />
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
