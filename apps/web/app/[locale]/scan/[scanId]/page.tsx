import Link from "next/link";

import { HeatmapChart } from "@/components/charts/heatmap-chart";
import { SeverityChart } from "@/components/charts/severity-chart";
import { BadgePublisher } from "@/components/ui/badge-publisher";
import { CompareWidget } from "@/components/ui/compare-widget";
import { FindingsPanel } from "@/components/ui/findings-panel";
import { ScanProgress } from "@/components/ui/scan-progress";

const API_BASE = process.env.BACKEND_API_BASE_URL ?? "http://localhost:8000";

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

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ scanId: string; locale: string }>;
}) {
  const { scanId, locale } = await params;
  const scan = await getScan(scanId);
  const heatmap = await getHeatmap(scanId);
  const severities = ["All", "Critical", "High", "Medium", "Low"];

  const severityCount = scan.findings.reduce(
    (acc: Record<string, number>, item: { severity: string }) => {
      acc[item.severity] = (acc[item.severity] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const chartData = Object.entries(severityCount).map(([name, value]) => ({
    name,
    value: Number(value),
  }));

  return (
    <main className="mx-auto max-w-7xl p-6 md:p-10">
      <ScanProgress scanId={scanId} initialStatus={scan.status} />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Scan {scan.id}</h1>
          <p className="text-sm text-slate-600">
            Status: {scan.status} | Risk: {scan.riskLevel} (
            {scan.riskPercent.toFixed(1)}%)
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/api/v1/scans/${scanId}/export?format=json`}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            JSON
          </Link>
          <Link
            href={`/api/v1/scans/${scanId}/export?format=pdf`}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            PDF
          </Link>
          <Link
            href={`/api/v1/scans/${scanId}/export?format=sarif`}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            SARIF
          </Link>
          <Link
            href={`/${locale}`}
            className="rounded-xl bg-brand-600 px-3 py-2 text-sm text-white"
          >
            New Scan
          </Link>
          <BadgePublisher scanId={scanId} />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">Severity Breakdown</h2>
          <SeverityChart data={chartData} />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold">
            Vulnerable File Heatmap
          </h2>
          <HeatmapChart data={heatmap.files ?? []} />
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Scan Comparison</h2>
        <CompareWidget scanId={scanId} />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Findings</h2>
        <div className="mb-4 flex flex-wrap gap-2">
          {severities.map((item) => (
            <span
              key={item}
              className="rounded-full border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600"
            >
              {item}
            </span>
          ))}
        </div>
        <FindingsPanel findings={scan.findings} />
      </section>
    </main>
  );
}
