"use client";

import { useState, useEffect } from "react";
import { ShieldCheck, RefreshCw, Loader2, XCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SupportAccessBanner } from "@/components/ui/support-access-banner";

type ScanItem = {
  id: string;
  projectId: string | null;
  status: string;
  riskLevel: string;
  riskPercent: number;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  createdAt: string;
  project?: { name: string };
};

export function AdminScansClient() {
  const [scans, setScans] = useState<ScanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchScans = async () => {
    setLoading(true);
    try {
      const url = `/api/admin/scans?status=${statusFilter}&page=${page}&limit=20`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setScans(data.scans || []);
        setTotalPages(data.totalPages ?? 1);
      }
    } catch (error) {
      console.error("Failed to fetch scans", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScans();
  }, [statusFilter, page]);

  const handleCancel = async (scanId: string) => {
    if (!confirm("Are you sure you want to force-cancel this stuck scan?")) return;
    setCancellingId(scanId);
    try {
      const res = await fetch(`/api/admin/scans/${scanId}/cancel`, { method: "POST" });
      if (res.ok) {
        fetchScans();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to cancel scan");
      }
    } catch (e) {
      alert("Network error");
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-8 h-8 text-brand" />
            Scan Debugger & Controller
          </h1>
          <p className="text-slate-400 mt-1">Monitor scan executions, inspect error traces, and cancel hanging jobs.</p>
        </div>
        <Button onClick={fetchScans} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <SupportAccessBanner />

      <div className="flex gap-2">
        {["", "queued", "running", "completed", "failed", "cancelled"].map((st) => (
          <Button
            key={st}
            size="sm"
            variant={statusFilter === st ? "default" : "outline"}
            onClick={() => { setStatusFilter(st); setPage(1); }}
            className="capitalize text-xs"
          >
            {st || "All Statuses"}
          </Button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading scans...
          </div>
        ) : scans.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No scans matching criteria.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-slate-300 text-xs uppercase">
                <th className="p-4 font-bold">Scan ID</th>
                <th className="p-4 font-bold">Project</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold">Risk</th>
                <th className="p-4 font-bold">Duration</th>
                <th className="p-4 font-bold">Error Info</th>
                <th className="p-4 font-bold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {scans.map((s) => {
                const canCancel = s.status === "queued" || s.status === "running";
                const isCancelling = cancellingId === s.id;
                return (
                  <tr key={s.id} className="hover:bg-muted/30 transition-colors">
                    <td className="p-4 font-mono text-xs text-slate-400 max-w-[120px] truncate" title={s.id}>
                      {s.id}
                    </td>
                    <td className="p-4 font-bold text-white">
                      {s.project?.name || "Unknown Project"}
                    </td>
                    <td className="p-4">
                      <Badge
                        variant={
                          s.status === "completed"
                            ? "default"
                            : s.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs uppercase"
                      >
                        {s.status}
                      </Badge>
                    </td>
                    <td className="p-4">
                      <span className="font-bold text-slate-300">{s.riskLevel}</span>
                      <span className="text-xs text-slate-500 ml-1">({Math.round(s.riskPercent)}%)</span>
                    </td>
                    <td className="p-4 text-xs text-slate-400">
                      {s.durationMs ? `${(s.durationMs / 1000).toFixed(1)}s` : "N/A"}
                    </td>
                    <td className="p-4 max-w-xs text-xs text-red-400 font-mono truncate" title={s.errorMessage || ""}>
                      {s.errorMessage ? (
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> {s.errorMessage}
                        </span>
                      ) : (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {canCancel && (
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleCancel(s.id)}
                          disabled={isCancelling}
                          className="h-8 px-2 text-xs"
                        >
                          {isCancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5 mr-1" />}
                          Force Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4 mt-4 px-4 pb-4">
            <p className="text-sm text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:bg-muted"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-md border border-border px-3 py-1.5 text-sm font-medium disabled:opacity-40 hover:bg-muted"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
