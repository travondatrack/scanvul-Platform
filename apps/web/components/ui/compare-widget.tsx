"use client";

import { GitCompareArrows, Loader2 } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

type CompareResult = {
  baseScanId: string;
  targetScanId: string;
  introducedCount: number;
  fixedCount: number;
  riskDelta: number;
};

const API_BASE = "";

export function CompareWidget({ scanId }: { scanId: string }) {
  const [baseScanId, setBaseScanId] = useState("");
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function compare() {
    if (!baseScanId.trim()) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/scans/${scanId}/compare/${baseScanId.trim()}`,
      );
      if (!response.ok) {
        throw new Error("Compare failed");
      }
      setResult(await response.json());
    } catch (compareError) {
      setResult(null);
      setError(
        compareError instanceof Error ? compareError.message : "Compare failed",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-2">
        <input
          value={baseScanId}
          onChange={(event) => setBaseScanId(event.target.value)}
          placeholder="Base scan ID for comparison"
          className="h-10 min-w-0 rounded-lg border border-slate-300 px-3 text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
        />
        <button
          type="button"
          onClick={compare}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={loading || !baseScanId.trim()}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <GitCompareArrows className="mr-2 h-4 w-4" />
          )}
          {loading ? "Comparing" : "Compare"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            ["Introduced", result.introducedCount, "text-red-700 bg-red-50"],
            ["Fixed", result.fixedCount, "text-emerald-700 bg-emerald-50"],
            [
              "Delta",
              result.riskDelta.toFixed(1),
              result.riskDelta > 0
                ? "text-orange-700 bg-orange-50"
                : "text-emerald-700 bg-emerald-50",
            ],
          ].map(([label, value, tone]) => (
            <div key={label} className={cn("rounded-lg p-3", tone as string)}>
              <p className="text-xs font-bold uppercase">{label}</p>
              <p className="mt-1 text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
