import { ArrowLeft, Download, FileJson, FileText, ShieldAlert } from "lucide-react";
import Link from "next/link";

import { HeatmapChart } from "@/components/charts/heatmap-chart";
import { SeverityChart } from "@/components/charts/severity-chart";
import { BadgePublisher } from "@/components/ui/badge-publisher";
import { CompareWidget } from "@/components/ui/compare-widget";
import { FindingsPanel } from "@/components/ui/findings-panel";
import { ScanProgress } from "@/components/ui/scan-progress";
import { requireScanAccess } from "@/lib/access";
import { requireActiveUser } from "@/lib/session";
import { cn } from "@/lib/utils";

const API_BASE = process.env.BACKEND_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? "http://127.0.0.1:8000";

async function getScan(scanId: string) {
  const response = await fetch(`${API_BASE}/api/v1/scans/${scanId}`, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error("Scan not found");
  }
  return response.json();
}

async function getHeatmap(scanId: string) {
  const response = await fetch(`${API_BASE}/api/v1/scans/${scanId}/heatmap`, {
    cache: "no-store",
  });
  if (!response.ok) {
    return { files: [] };
  }
  return response.json();
}

const riskTone: Record<string, string> = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  Unknown: "border-slate-200 bg-slate-50 text-slate-600",
};

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ scanId: string; locale: string }>;
}) {
  const user = await requireActiveUser();
  const { scanId, locale } = await params;
  await requireScanAccess(user.id, scanId, "view");
  const scan = await getScan(scanId);
  const heatmap = await getHeatmap(scanId);

  const severityCount = scan.findings.reduce(
    (acc: Record<string, number>, item: { severity: string }) => {
      acc[item.severity] = (acc[item.severity] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const chartData = ["Critical", "High", "Medium", "Low"]
    .map((name) => ({ name, value: Number(severityCount[name] ?? 0) }))
    .filter((item) => item.value > 0);

  const topFiles = [...(heatmap.files ?? [])]
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  const categoryCount = scan.findings.reduce(
    (acc: Record<string, number>, item: { scanCategory: string }) => {
      acc[item.scanCategory] = (acc[item.scanCategory] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const metrics = [
    { label: "Status", value: scan.status },
    { label: "Risk", value: scan.riskLevel },
    { label: "Risk Score", value: `${scan.riskPercent.toFixed(1)}%` },
    { label: "Findings", value: scan.findings.length.toString() },
  ];

  const panelFindings = scan.findings.map((f: any) => ({
    id: f.id,
    status: f.status,
    assigneeId: f.assignee_id ?? undefined,
    severity: f.severity,
    ruleId: f.rule_id ?? "",
    scanCategory: f.scan_category ?? "SAST source code",
    engine: f.engine,
    title: f.title,
    filePath: f.file_path,
    lineNumber: f.line_number,
    lineStart: f.line_start ?? f.line_number,
    lineEnd: f.line_end ?? f.line_number,
    source: f.source ?? "",
    sink: f.sink ?? "",
    functionName: f.function_name ?? "",
    whyVulnerable: f.why_vulnerable ?? "",
    attackScenario: f.attack_scenario ?? "",
    impact: f.impact ?? "",
    remediation: f.remediation ?? "",
    poc: f.poc ?? "",
    codeSnippet: f.code_snippet ?? "",
    evidence: f.evidence ?? "",
    pentestHint: f.pentest_hint ?? "",
    references: f.ext_references ?? "",
    cvss4: f.cvss4_score,
    confidence: f.confidence,
    verificationStatus: f.verification_status ?? "unverified",
    dedupeHash: f.dedupe_hash ?? "",
    dataflowTrace: f.dataflow_trace ?? "",
    vulnType: f.vuln_type ?? "",
    cweId: f.cwe_id ?? "",
    owaspCategory: f.owasp_category ?? "",
  }));

  return (
    <main className="min-h-screen px-4 py-5 md:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <Link
              href={`/${locale}`}
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
            >
              <ArrowLeft className="h-4 w-4" />
              New Scan
            </Link>
            <h1 className="truncate text-2xl font-bold text-slate-950 md:text-3xl">
              Scan {scan.id}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {Object.entries(scan.languageSummary ?? {})
                .map(([key, value]) => `${key}: ${value}`)
                .join(" | ") || "No language summary"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { format: "json", label: "JSON", icon: FileJson },
              { format: "pdf", label: "PDF", icon: FileText },
              { format: "sarif", label: "SARIF", icon: Download },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.format}
                  href={`/api/v1/scans/${scanId}/export?format=${item.format}`}
                  className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400"
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
            <BadgePublisher scanId={scanId} />
          </div>
        </div>

        <ScanProgress scanId={scanId} initialStatus={scan.status} />

        <section className="mb-5 grid gap-3 md:grid-cols-4">
          {metrics.map((item, index) => (
            <div
              key={item.label}
              className="animate-fade-up rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm"
              style={{ animationDelay: `${index * 45}ms` }}
            >
              <p className="text-xs font-bold uppercase text-slate-500">
                {item.label}
              </p>
              <p
                className={cn(
                  "mt-2 text-2xl font-bold text-slate-950",
                  item.label === "Risk" &&
                    "inline-flex rounded-full border px-3 py-1 text-base",
                  item.label === "Risk" &&
                    (riskTone[scan.riskLevel] ?? riskTone.Unknown),
                )}
              >
                {item.value}
              </p>
            </div>
          ))}
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Severity Breakdown</h2>
                  <ShieldAlert className="h-5 w-5 text-slate-400" />
                </div>
                <SeverityChart data={chartData} />
              </section>
              <section className="rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
                <h2 className="mb-3 text-lg font-semibold">
                  Vulnerable File Heatmap
                </h2>
                <HeatmapChart data={heatmap.files ?? []} />
              </section>
            </div>

            <section className="rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Findings</h2>
                <div className="flex flex-wrap gap-2">
                  {["Critical", "High", "Medium", "Low"].map((severity) => (
                    <span
                      key={severity}
                      className={cn(
                        "rounded-full border px-2 py-1 text-xs font-semibold",
                        riskTone[severity],
                      )}
                    >
                      {severityCount[severity] ?? 0} {severity}
                    </span>
                  ))}
                </div>
              </div>
              <FindingsPanel findings={panelFindings} />
            </section>
          </div>

          <aside className="space-y-5">
            <section className="rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Scan Comparison</h2>
              <CompareWidget scanId={scanId} />
            </section>

            <section className="rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Top Files</h2>
              <div className="space-y-2">
                {topFiles.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">
                    No affected files.
                  </p>
                ) : (
                  topFiles.map((file) => (
                    <div
                      key={file.file}
                      className="rounded-lg border border-slate-200 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                        <span className="truncate font-mono text-slate-700">
                          {file.file}
                        </span>
                        <span className="font-bold text-slate-950">
                          {file.count}
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-slate-900"
                          style={{
                            width: `${Math.min(
                              100,
                              (file.count / Math.max(topFiles[0]?.count ?? 1, 1)) * 100,
                            )}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Scan Types</h2>
              <div className="space-y-2">
                {["Secret scan", "SAST source code", "Dependency scan", "Config scan"].map(
                  (category) => (
                    <div
                      key={category}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                    >
                      <span className="font-medium text-slate-700">{category}</span>
                      <span className="font-bold text-slate-950">
                        {categoryCount[category] ?? 0}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
