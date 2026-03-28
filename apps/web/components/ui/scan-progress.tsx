"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  scanId: string;
  initialStatus: string;
};

const API_BASE = "";

export function ScanProgress({ scanId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [tick, setTick] = useState(0);
  const refreshedOnce = useRef(false);
  const previousStatus = useRef(initialStatus);

  useEffect(() => {
    if (status === "completed" || status === "failed") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/scans/${scanId}`, {
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        setStatus(data.status);
        setTick((prev) => prev + 1);
      } catch {
        setTick((prev) => prev + 1);
      }
    }, 1800);

    return () => window.clearInterval(timer);
  }, [scanId, status]);

  useEffect(() => {
    const wasActive = ["queued", "running"].includes(previousStatus.current);
    const isTerminal = status === "completed" || status === "failed";

    if (isTerminal && wasActive && !refreshedOnce.current) {
      refreshedOnce.current = true;
      window.setTimeout(() => {
        window.location.reload();
      }, 700);
    }

    previousStatus.current = status;
  }, [status]);

  const progress = useMemo(() => {
    if (status === "queued") {
      return Math.min(35, 8 + tick * 6);
    }
    if (status === "running") {
      return Math.min(95, 35 + tick * 7);
    }
    if (status === "completed") {
      return 100;
    }
    if (status === "failed") {
      return 100;
    }
    return 10;
  }, [status, tick]);

  const label =
    status === "queued"
      ? "Queued: preparing scan workspace"
      : status === "running"
        ? "Running: analyzing source and correlating findings"
        : status === "completed"
          ? "Completed: refreshing result view"
          : status === "failed"
            ? "Failed: refreshing to show final state"
            : `Status: ${status}`;

  const barColor = status === "failed" ? "bg-red-500" : "bg-sky-500";

  return (
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Scan Progress</h2>
        <span className="text-xs font-medium text-slate-600">
          {Math.round(progress)}%
        </span>
      </div>
      <p className="mb-3 text-xs text-slate-600">{label}</p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full ${barColor} transition-all duration-500 ${
            status === "queued" || status === "running" ? "animate-pulse" : ""
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {(status === "queued" || status === "running") && (
        <p className="mt-2 text-xs text-slate-500">
          Auto refresh when scan finishes.
        </p>
      )}
    </section>
  );
}
