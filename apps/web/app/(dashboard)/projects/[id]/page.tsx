import { prisma } from "@/lib/prisma";
import { accessibleProjectWhere, canTriggerScan, canManageProject } from "@/lib/access";
import { requireActiveUser } from "@/lib/session";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, RefreshCw, AlertTriangle, Clock, FolderKanban, ChevronLeft, ChevronRight } from "lucide-react";
import TriggerScanButton from "../../../../components/TriggerScanButton";
import { AutoRefresher } from "../../../../components/AutoRefresher";
import { formatVietnamDateTime } from "@/lib/date-format";

const PAGE_SIZE = 10;

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await requireActiveUser();
  const resolvedParams = await params;
  const resolvedSearch = await searchParams;

  const page = Math.max(1, parseInt(resolvedSearch.page ?? "1", 10));
  const skip = (page - 1) * PAGE_SIZE;

  const project = await prisma.project.findFirst({
    where: {
      id: resolvedParams.id,
      ...(user.roleGlobal === "admin" ? {} : accessibleProjectWhere(user.id, "view")),
    },
    include: {
      organization: { select: { id: true, name: true, slug: true } },
    },
  });

  if (!project) notFound();

  const [scans, totalScans] = await Promise.all([
    prisma.scan.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip,
    }),
    prisma.scan.count({ where: { projectId: project.id } }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalScans / PAGE_SIZE));
  const hasRunningScans = scans.some(s => s.status === "queued" || s.status === "running");
  const canTrigger = await canTriggerScan(user.id, project.id);
  const [latestScans, scannerPolicy] = await Promise.all([
    prisma.scan.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        findings: {
          select: {
            id: true,
            severity: true,
            status: true,
            filePath: true,
            engine: true,
            owaspCategory: true,
            dedupeHash: true,
            ruleId: true,
            lineNumber: true,
          },
        },
      },
    }),
    prisma.scannerPolicy.findFirst({ where: { projectId: project.id } }),
  ]);
  const latestScan = latestScans[0];
  const previousScan = latestScans[1];
  const unresolvedHighCritical = latestScan?.findings.filter((f) =>
    ["critical", "high"].includes(f.severity.toLowerCase()) &&
    !["fixed", "false_positive", "ignored"].includes(f.status)
  ).length ?? 0;
  const topFiles = Object.entries((latestScan?.findings ?? []).reduce<Record<string, number>>((acc, f) => {
    acc[f.filePath] = (acc[f.filePath] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const byEngine = Object.entries((latestScan?.findings ?? []).reduce<Record<string, number>>((acc, f) => {
    acc[f.engine] = (acc[f.engine] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const byOwasp = Object.entries((latestScan?.findings ?? []).reduce<Record<string, number>>((acc, f) => {
    const key = f.owaspCategory || "Unmapped";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const currentKeys = new Set((latestScan?.findings ?? []).map((f) => f.dedupeHash || `${f.ruleId}:${f.filePath}:${f.lineNumber}`));
  const previousKeys = new Set((previousScan?.findings ?? []).map((f) => f.dedupeHash || `${f.ruleId}:${f.filePath}:${f.lineNumber}`));
  const newFindings = [...currentKeys].filter((key) => !previousKeys.has(key)).length;
  const fixedFindings = [...previousKeys].filter((key) => !currentKeys.has(key)).length;
  const unchangedFindings = [...currentKeys].filter((key) => previousKeys.has(key)).length;
  const riskTrend = latestScans.slice(0, 5).map((scan) => Math.round(scan.riskPercent ?? 0)).reverse();

  const buildPageUrl = (p: number) => `?page=${p}`;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {hasRunningScans && <AutoRefresher />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-foreground tracking-tight">{project.name}</h1>
          <p className="text-slate-500 dark:text-zinc-400 mt-1 flex items-center space-x-2">
            <FolderKanban className="w-4 h-4" />
            <span>{project.repoUrl || "No Repository linked"}</span>
            <span>·</span>
            <span>{project.organization?.name ?? "Personal project"}</span>
          </p>
        </div>
        {canTrigger && <TriggerScanButton projectId={project.id} repoUrl={project.repoUrl || ""} />}
      </div>

      {/* Security Overview */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">Security Overview</h2>
            {latestScan && <Link href={`/scan/${latestScan.id}`} className="text-sm font-bold text-brand hover:underline">Open latest scan</Link>}
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Latest status</p>
              <p className="mt-1 font-bold capitalize">{latestScan?.status ?? "No scan"}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Risk</p>
              <p className="mt-1 font-bold">{latestScan?.riskLevel ?? "Unknown"} {latestScan?.riskPercent != null ? `(${latestScan.riskPercent.toFixed(0)}%)` : ""}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Critical/High open</p>
              <p className="mt-1 font-bold text-orange-400">{unresolvedHighCritical}</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs uppercase text-muted-foreground">Last duration</p>
              <p className="mt-1 font-bold">{latestScan?.durationMs ? `${Math.round(latestScan.durationMs / 1000)}s` : "N/A"}</p>
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">Top vulnerable files</p>
              <div className="space-y-1 text-sm">{topFiles.length ? topFiles.map(([file, count]) => <p key={file} className="truncate"><span className="font-bold">{count}</span> {file}</p>) : <p className="text-muted-foreground">No findings.</p>}</div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">By engine</p>
              <div className="space-y-1 text-sm">{byEngine.length ? byEngine.map(([engine, count]) => <p key={engine}><span className="font-bold">{count}</span> {engine}</p>) : <p className="text-muted-foreground">No findings.</p>}</div>
            </div>
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-muted-foreground">By OWASP</p>
              <div className="space-y-1 text-sm">{byOwasp.length ? byOwasp.map(([cat, count]) => <p key={cat} className="truncate"><span className="font-bold">{count}</span> {cat}</p>) : <p className="text-muted-foreground">No mapped findings.</p>}</div>
            </div>
          </div>
          <div className="mt-4 flex items-end gap-1 rounded-lg border border-border bg-muted/20 p-3">
            {riskTrend.length ? riskTrend.map((value, index) => (
              <div key={`${value}-${index}`} className="w-8 rounded-t bg-brand" style={{ height: `${Math.max(6, value)}px` }} title={`${value}%`} />
            )) : <p className="text-sm text-muted-foreground">Risk trend will appear after scans.</p>}
          </div>
        </div>
        <div className="bg-card text-card-foreground border border-border rounded-xl p-5 shadow-sm">
          <h2 className="text-xl font-bold text-foreground">Compare Scans</h2>
          {latestScan && previousScan ? (
            <div className="mt-4 grid gap-3">
              <p className="text-sm text-muted-foreground">Compared latest scan with the previous scan.</p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-lg font-bold text-red-400">{newFindings}</p><p className="text-xs text-muted-foreground">new</p></div>
                <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-lg font-bold text-emerald-400">{fixedFindings}</p><p className="text-xs text-muted-foreground">fixed</p></div>
                <div className="rounded-lg border border-border bg-muted/30 p-3"><p className="text-lg font-bold">{unchangedFindings}</p><p className="text-xs text-muted-foreground">unchanged</p></div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted-foreground">Run at least two scans to compare changes.</p>
          )}
          <div className="mt-5 rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-bold uppercase text-muted-foreground">Enabled policy</p>
            <p className="mt-1 text-sm">{scannerPolicy ? `${scannerPolicy.severityThreshold}+ / ${scannerPolicy.enabledEngines}` : "Default scanner policy"}</p>
          </div>
        </div>
      </div>

      {/* Scan History */}
      <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold flex items-center space-x-2 text-foreground">
            <Clock className="w-5 h-5 text-brand" />
            <span>Scan History</span>
          </h2>
          <span className="text-sm text-muted-foreground">
            {totalScans} scan{totalScans !== 1 ? "s" : ""} total
          </span>
        </div>

        {totalScans === 0 ? (
          <div className="text-center py-12">
            <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-muted-foreground">No scans have been executed for this project yet.</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {scans.map(scan => (
                <Link key={scan.id} href={`/scan/${scan.id}`} className="block">
                  <div className="flex items-center justify-between p-4 bg-muted/40 border border-border hover:border-brand/40 hover:bg-muted rounded-xl transition-all duration-300 group">
                    <div className="flex items-center space-x-4">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-sm ${
                        scan.status === "completed" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        scan.status === "failed" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                        "bg-brand/10 border-brand/20 text-brand"
                      }`}>
                        {scan.status === "completed" && <ShieldCheck className="w-5 h-5" />}
                        {scan.status === "failed" && <AlertTriangle className="w-5 h-5" />}
                        {(scan.status === "queued" || scan.status === "running") && <RefreshCw className="w-5 h-5 animate-spin" />}
                      </div>
                      <div>
                        <h4 className="font-bold text-foreground group-hover:text-brand transition-colors">
                          Scan {scan.id.split("-")[0]}...
                        </h4>
                        <p className="text-xs text-muted-foreground/70">{formatVietnamDateTime(scan.createdAt)}</p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-6">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground/70 mb-0.5">Risk Level</p>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                          scan.riskLevel === "Critical" ? "bg-red-500/10 border-red-500/20 text-red-400" :
                          scan.riskLevel === "High" ? "bg-orange-500/10 border-orange-500/20 text-orange-400" :
                          scan.riskLevel === "Low" ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                          "bg-muted/40 border-border text-slate-300"
                        }`}>{scan.riskLevel || "Unknown"}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground/70 mb-0.5">Status</p>
                        <p className="font-bold text-foreground capitalize">{scan.status}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                {/* Left: info */}
                <p className="text-sm text-muted-foreground">
                  Showing <span className="font-semibold text-foreground">{skip + 1}–{Math.min(skip + PAGE_SIZE, totalScans)}</span> of{" "}
                  <span className="font-semibold text-foreground">{totalScans}</span> scans
                </p>

                {/* Right: nav */}
                <div className="flex items-center space-x-1">
                  {/* Prev */}
                  {page > 1 ? (
                    <Link
                      href={buildPageUrl(page - 1)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-brand/40 text-sm font-medium text-foreground transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </Link>
                  ) : (
                    <span className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-sm font-medium text-muted-foreground/40 cursor-not-allowed">
                      <ChevronLeft className="w-4 h-4" />
                      <span>Prev</span>
                    </span>
                  )}

                  {/* Page numbers */}
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((item, idx) =>
                      item === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-muted-foreground">…</span>
                      ) : (
                        <Link
                          key={item}
                          href={buildPageUrl(item as number)}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-medium transition-all ${
                            item === page
                              ? "bg-brand text-white border border-brand shadow-sm shadow-brand/20"
                              : "border border-border bg-muted/40 hover:bg-muted hover:border-brand/40 text-foreground"
                          }`}
                        >
                          {item}
                        </Link>
                      )
                    )}

                  {/* Next */}
                  {page < totalPages ? (
                    <Link
                      href={buildPageUrl(page + 1)}
                      className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-border bg-muted/40 hover:bg-muted hover:border-brand/40 text-sm font-medium text-foreground transition-all"
                    >
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  ) : (
                    <span className="flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-border/40 bg-muted/20 text-sm font-medium text-muted-foreground/40 cursor-not-allowed">
                      <span>Next</span>
                      <ChevronRight className="w-4 h-4" />
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
