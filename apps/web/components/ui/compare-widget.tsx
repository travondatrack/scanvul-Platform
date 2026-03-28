"use client";

import { useState } from "react";

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

  async function compare() {
    if (!baseScanId.trim()) return;
    setLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/scans/${scanId}/compare/${baseScanId.trim()}`,
      );
      if (!response.ok) {
        throw new Error("Compare failed");
      }
      setResult(await response.json());
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={baseScanId}
          onChange={(event) => setBaseScanId(event.target.value)}
          placeholder="Base scan ID for comparison"
          className="min-w-64 rounded-lg border border-slate-300 px-2 py-2 text-sm"
        />
        <button
          type="button"
          onClick={compare}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
          disabled={loading}
        >
          {loading ? "Comparing..." : "Compare"}
        </button>
      </div>

      {result ? (
        <p className="mt-2 text-sm text-slate-600">
          Introduced: {result.introducedCount} | Fixed: {result.fixedCount} |
          Risk Delta: {result.riskDelta.toFixed(1)}
        </p>
      ) : null}
    </div>
  );
}
