"use client";

import { CheckCircle2, CircleDashed, Loader2, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  scanId: string;
  initialStatus: string;
};

const API_BASE = "";

export function ScanProgress({ scanId, initialStatus }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [tick, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
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
        setLastUpdated(new Date());
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
      ? "Preparing scan workspace"
      : status === "running"
        ? "Analyzing source and correlating findings"
        : status === "completed"
          ? "Result is ready"
          : status === "failed"
            ? "Scan failed"
            : `Status: ${status}`;

  const barColor =
    status === "failed"
      ? "bg-red-500"
      : status === "completed"
        ? "bg-emerald-500"
        : "bg-slate-900";

  const steps = [
    { key: "queued", label: "Queued" },
    { key: "running", label: "Scanning" },
    { key: "completed", label: "Done" },
  ];

  const activeIndex =
    status === "completed" ? 2 : status === "running" ? 1 : status === "failed" ? -1 : 0;

  return (
    <section className="scan-surface mb-5 rounded-lg border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Scan Progress</h2>
          <p className="mt-1 text-xs text-slate-500">{label}</p>
        </div>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {Math.round(progress)}%
        </span>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2">
        {steps.map((step, index) => {
          const complete = index < activeIndex || status === "completed";
          const active = index === activeIndex && status !== "completed";
          const failed = status === "failed" && index === 1;
          return (
            <div
              key={step.key}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold",
                complete && "border-emerald-200 bg-emerald-50 text-emerald-700",
                active && "border-sky-200 bg-sky-50 text-sky-700",
                failed && "border-red-200 bg-red-50 text-red-700",
                !complete && !active && !failed && "border-slate-200 bg-slate-50 text-slate-500",
              )}
            >
              {failed ? (
                <XCircle className="h-4 w-4" />
              ) : complete ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : active ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CircleDashed className="h-4 w-4" />
              )}
              {step.label}
            </div>
          );
        })}
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            barColor,
            (status === "queued" || status === "running") && "progress-animated",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>
      {(status === "queued" || status === "running") && (
        <p className="mt-2 text-xs text-slate-500">
          Auto refreshes when the scan finishes
          {lastUpdated ? `; last checked ${lastUpdated.toLocaleTimeString()}` : ""}.
        </p>
      )}
    </section>
  );
}
