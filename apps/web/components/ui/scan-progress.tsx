"use client";

import { CheckCircle2, CircleDashed, Loader2, XCircle, RefreshCw, Ban } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatVietnamTime } from "@/lib/date-format";

const STALE_QUEUED_MS = 5 * 60 * 1000;  // 5 min in queue → stale
const STALE_RUNNING_MS = 20 * 60 * 1000; // 20 min running → stale

type Props = {
  scanId: string;
  initialStatus: string;
  projectId?: string;
  repoUrl?: string;
  sourceType?: string;
};

const API_BASE = "";

export function ScanProgress({ scanId, initialStatus, projectId, repoUrl, sourceType }: Props) {
  const [status, setStatus] = useState(initialStatus);
  const [tick, setTick] = useState(0);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);
  const refreshedOnce = useRef(false);
  const previousStatus = useRef(initialStatus);

  // Poll for status while active
  useEffect(() => {
    if (status === "completed" || status === "failed") {
      return;
    }

    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(`${API_BASE}/api/v1/scans/${scanId}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = await response.json();
        setStatus(data.status);
        setLastUpdated(new Date());
        setTick((prev) => prev + 1);
        if (data.created_at) setCreatedAt(new Date(data.created_at));
        if (data.started_at) setStartedAt(new Date(data.started_at));
      } catch {
        setTick((prev) => prev + 1);
      }
    }, 1800);

    return () => window.clearInterval(timer);
  }, [scanId, status]);

  // Page reload on completion
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

  // Detect stale scan
  useEffect(() => {
    if (status !== "queued" && status !== "running") {
      setIsStale(false);
      return;
    }

    const checkStale = () => {
      const now = Date.now();
      if (status === "queued" && createdAt) {
        setIsStale(now - createdAt.getTime() > STALE_QUEUED_MS);
      } else if (status === "running" && startedAt) {
        setIsStale(now - startedAt.getTime() > STALE_RUNNING_MS);
      }
    };

    checkStale();
    const t = window.setInterval(checkStale, 15000);
    return () => window.clearInterval(t);
  }, [status, createdAt, startedAt]);

  const handleCancel = async () => {
    if (!confirm("Huỷ scan này và đánh dấu là thất bại?")) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/scans/${scanId}/cancel`, { method: "POST" });
      if (res.ok) {
        setStatus("failed");
        window.setTimeout(() => window.location.reload(), 600);
      }
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRescan = async () => {
    if (!projectId) {
      alert("Không tìm thấy project để rescan.");
      return;
    }
    setIsRescanning(true);
    try {
      const res = await fetch("/api/scans/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          sourceType: sourceType ?? "repo_url",
          sourceValue: repoUrl ?? "",
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        window.location.href = `/scan/${data.id}`;
      } else {
        alert(data.error || "Không thể trigger scan mới.");
      }
    } finally {
      setIsRescanning(false);
    }
  };

  const progress = useMemo(() => {
    if (status === "queued") return Math.min(35, 8 + tick * 6);
    if (status === "running") return Math.min(95, 35 + tick * 7);
    if (status === "completed") return 100;
    if (status === "failed") return 100;
    return 10;
  }, [status, tick]);

  const label =
    status === "queued"
      ? isStale
        ? "⚠️ Scan đang bị treo quá lâu trong hàng chờ"
        : "Preparing scan workspace"
      : status === "running"
        ? isStale
          ? "⚠️ Scan chạy quá lâu, có thể bị treo"
          : "Analyzing source and correlating findings"
        : status === "completed"
          ? "Result is ready"
          : status === "failed"
            ? "Scan failed"
            : `Status: ${status}`;

  const barColor =
    status === "failed"
      ? "bg-red-500"
      : isStale
        ? "bg-amber-500"
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
          <p className={cn("mt-1 text-xs", isStale ? "text-amber-600 font-semibold" : "text-slate-500")}>
            {label}
          </p>
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
                active && !isStale && "border-sky-200 bg-sky-50 text-sky-700",
                active && isStale && "border-amber-200 bg-amber-50 text-amber-700",
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
            (status === "queued" || status === "running") && !isStale && "progress-animated",
          )}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Normal polling message */}
      {(status === "queued" || status === "running") && !isStale && (
        <p className="mt-2 text-xs text-slate-500">
          Auto refreshes when the scan finishes
          {lastUpdated ? `; last checked ${formatVietnamTime(lastUpdated)}` : ""}.
        </p>
      )}

      {/* Stale scan warning + actions */}
      {isStale && (status === "queued" || status === "running") && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs font-semibold text-amber-800 mb-2">
            {status === "queued"
              ? "Scan đã chờ hơn 5 phút. Worker có thể không hoạt động."
              : "Scan đã chạy hơn 20 phút. Có thể bị treo hoặc timeout."}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="border-amber-400 text-amber-700 hover:bg-amber-100 gap-1.5"
              disabled={isCancelling}
              onClick={handleCancel}
            >
              {isCancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <Ban className="h-3 w-3" />}
              Huỷ scan
            </Button>
            {projectId && (
              <Button
                size="sm"
                variant="default"
                className="gap-1.5"
                disabled={isRescanning}
                onClick={handleRescan}
              >
                {isRescanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                Rescan
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Failed state rescan */}
      {status === "failed" && projectId && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            size="sm"
            variant="default"
            className="gap-1.5"
            disabled={isRescanning}
            onClick={handleRescan}
          >
            {isRescanning ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Rescan lại
          </Button>
        </div>
      )}
    </section>
  );
}
