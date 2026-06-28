"use client";

import { useState, useEffect } from "react";
import { ShieldAlert, Lock, KeyRound, Clock, XCircle, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SupportAccessItem = {
  id: string;
  projectId: string | null;
  organizationId: string | null;
  scopes: string;
  reason: string;
  expiresAt: string;
};

export function SupportAccessBanner() {
  const [activeList, setActiveList] = useState<SupportAccessItem[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [orgId, setOrgId] = useState("");
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("3600");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["view_metadata", "view_findings"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchActive = async () => {
    try {
      const res = await fetch("/api/admin/support-access");
      if (res.ok) {
        const data = await res.json();
        setActiveList(data || []);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchActive();
  }, []);

  const handleGrant = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/support-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId.trim() || undefined,
          organizationId: orgId.trim() || undefined,
          scopes: selectedScopes,
          reason: reason.trim(),
          durationSeconds: Number(duration),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to grant access");
      }

      setModalOpen(false);
      setProjectId("");
      setOrgId("");
      setReason("");
      fetchActive();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await fetch(`/api/admin/support-access/${id}`, { method: "DELETE" });
      fetchActive();
    } catch {
      // ignore
    }
  };

  const toggleScope = (scope: string) => {
    if (selectedScopes.includes(scope)) {
      setSelectedScopes(selectedScopes.filter((s) => s !== scope));
    } else {
      setSelectedScopes([...selectedScopes, scope]);
    }
  };

  return (
    <div className="space-y-3 mb-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-amber-300">Least Privilege & Privacy Policy: </span>
            You are viewing administrative metadata. Raw secrets, tokens, and private source code cannot be accessed without Break-Glass Support Access.
          </div>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          size="sm"
          className="bg-amber-600 hover:bg-amber-500 text-white font-bold flex items-center gap-2 flex-shrink-0"
        >
          <KeyRound className="w-4 h-4" /> Break-Glass Access
        </Button>
      </div>

      {activeList.length > 0 && (
        <div className="rounded-xl border border-brand/40 bg-brand/10 p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-brand font-bold">
            <CheckCircle2 className="w-4 h-4" /> Support Access Active:
            {activeList.map((item) => (
              <span key={item.id} className="bg-brand/20 px-2 py-0.5 rounded text-xs text-white">
                {item.projectId ? `Project: ${item.projectId}` : `Org: ${item.organizationId}`} (Exp: {new Date(item.expiresAt).toLocaleTimeString()})
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {activeList.map((item) => (
              <Button
                key={item.id}
                onClick={() => handleRevoke(item.id)}
                size="sm"
                variant="destructive"
                className="h-7 text-xs flex items-center gap-1"
              >
                <XCircle className="w-3 h-3" /> Revoke
              </Button>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" /> Grant Break-Glass Support
              </h3>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <p className="text-xs text-slate-400">
              Only super_admin can grant support access. Every request is recorded in immutable audit logs.
            </p>

            {error && <div className="text-xs text-red-400 bg-red-950/50 p-2 rounded border border-red-500/30">{error}</div>}

            <form onSubmit={handleGrant} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Target Project ID</label>
                <Input placeholder="e.g. prj_123" value={projectId} onChange={(e) => setProjectId(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Or Target Organization ID</label>
                <Input placeholder="e.g. org_456" value={orgId} onChange={(e) => setOrgId(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Reason for Access (Required, min 5 chars)</label>
                <textarea
                  className="w-full rounded-md border border-border bg-background p-2 text-white text-xs focus:outline-none focus:ring-1 focus:ring-brand"
                  rows={2}
                  placeholder="Customer ticket #1234 requested debug support..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Duration</label>
                <select
                  className="w-full rounded-md border border-border bg-background p-2 text-white text-xs"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                >
                  <option value="1800">30 Minutes</option>
                  <option value="3600">1 Hour</option>
                  <option value="14400">4 Hours</option>
                  <option value="86400">24 Hours</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Scopes</label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {["view_metadata", "view_findings", "view_source", "manage_scan", "manage_policy"].map((sc) => (
                    <label key={sc} className="flex items-center gap-2 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        checked={selectedScopes.includes(sc)}
                        onChange={() => toggleScope(sc)}
                        className="rounded accent-brand"
                      />
                      {sc}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <Button type="button" variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={loading}>{loading ? "Granting..." : "Authorize Access"}</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
