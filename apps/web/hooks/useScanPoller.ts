"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type ScanStatus = "queued" | "running" | "completed" | "failed";

export type ScanStatusData = {
  id: string;
  status: ScanStatus;
  riskLevel: string;
  riskPercent: number;
  updatedAt: string;
};

type PollOptions = {
  /** Polling interval in ms. Default: 3000 */
  intervalMs?: number;
  /** Stop polling after this many ms regardless. Default: 10 minutes. */
  maxDurationMs?: number;
  /** Called whenever status changes */
  onStatusChange?: (status: ScanStatus, data: ScanStatusData) => void;
  /** Called when scan reaches a terminal state (completed | failed) */
  onComplete?: (data: ScanStatusData) => void;
  /** Whether to start polling immediately. Default: true */
  enabled?: boolean;
};

type PollResult = {
  data: ScanStatusData | null;
  isPolling: boolean;
  error: string | null;
  /** Force an immediate refresh outside of the normal interval */
  refresh: () => void;
  /** Manually stop polling */
  stop: () => void;
  /** Restart polling (e.g. after triggering a new scan) */
  start: () => void;
};

const TERMINAL_STATUSES: ScanStatus[] = ["completed", "failed"];

/**
 * Poll the scan status endpoint until the scan reaches a terminal state.
 *
 * Uses /api/v1/scans/{scanId}/status (lightweight — no findings payload).
 *
 * @example
 * const { data, isPolling } = useScanPoller(scan.id);
 * // data.status → "queued" | "running" | "completed" | "failed"
 */
export function useScanPoller(
  scanId: string | null | undefined,
  options: PollOptions = {},
): PollResult {
  const {
    intervalMs = 3000,
    maxDurationMs = 10 * 60 * 1000, // 10 minutes
    onStatusChange,
    onComplete,
    enabled = true,
  } = options;

  const [data, setData] = useState<ScanStatusData | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const prevStatusRef = useRef<ScanStatus | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
    timerRef.current = null;
    maxTimerRef.current = null;
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!scanId || !activeRef.current) return;

    try {
      const res = await fetch(`/api/v1/scans/${scanId}/status`);
      if (!res.ok) {
        if (res.status === 404) {
          setError("Scan not found");
          setIsPolling(false);
          activeRef.current = false;
          clearTimers();
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const json = (await res.json()) as ScanStatusData;
      setData(json);
      setError(null);

      // Notify on status change
      if (prevStatusRef.current !== json.status) {
        onStatusChange?.(json.status, json);
        prevStatusRef.current = json.status;
      }

      // Stop polling on terminal status
      if (TERMINAL_STATUSES.includes(json.status)) {
        setIsPolling(false);
        activeRef.current = false;
        clearTimers();
        onComplete?.(json);
        return;
      }

      // Schedule next poll
      if (activeRef.current) {
        timerRef.current = setTimeout(fetchStatus, intervalMs);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      // Retry unless explicitly stopped
      if (activeRef.current) {
        timerRef.current = setTimeout(fetchStatus, intervalMs * 2); // back-off on error
      }
    }
  }, [scanId, intervalMs, onStatusChange, onComplete, clearTimers]);

  const stop = useCallback(() => {
    activeRef.current = false;
    setIsPolling(false);
    clearTimers();
  }, [clearTimers]);

  const start = useCallback(() => {
    if (!scanId) return;
    clearTimers();
    activeRef.current = true;
    setIsPolling(true);
    setError(null);
    prevStatusRef.current = null;

    // Safety: stop after maxDurationMs regardless
    maxTimerRef.current = setTimeout(() => {
      if (activeRef.current) {
        stop();
        setError("Polling timed out. Check scan status manually.");
      }
    }, maxDurationMs);

    fetchStatus();
  }, [scanId, fetchStatus, stop, clearTimers, maxDurationMs]);

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    fetchStatus();
  }, [fetchStatus]);

  // Auto-start when scanId changes and polling is enabled
  useEffect(() => {
    if (!scanId || !enabled) {
      stop();
      return;
    }

    // Only auto-start if the current status is non-terminal (or unknown)
    const currentStatus = data?.status;
    if (currentStatus && TERMINAL_STATUSES.includes(currentStatus)) {
      return; // already done, don't restart
    }

    start();

    return () => {
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanId, enabled]);

  return { data, isPolling, error, refresh, stop, start };
}
