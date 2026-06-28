"use client";

import { useState, useEffect } from "react";
import { Database, RefreshCw, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type AuditItem = {
  id: string;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  metadata: any;
  ipAddress: string | null;
  createdAt: string;
};

export function AdminAuditClient() {
  const [events, setEvents] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const url = actionFilter ? `/api/admin/audit-events?action=${encodeURIComponent(actionFilter)}` : `/api/admin/audit-events`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events || []);
      }
    } catch (error) {
      console.error("Failed to fetch audit events", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <Database className="w-8 h-8 text-brand" />
            Immutable Audit Logs
          </h1>
          <p className="text-slate-400 mt-1">Read-only audit records of administrative interventions, state changes, and security events.</p>
        </div>
        <Button onClick={fetchEvents} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="flex gap-3 max-w-md">
        <Input
          placeholder="Filter by action name (e.g. ADMIN_USER_LOCKED)..."
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchEvents()}
        />
        <Button onClick={fetchEvents}>Filter</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading audit logs...
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No audit records found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-slate-300 text-xs uppercase">
                <th className="p-4 font-bold">Action</th>
                <th className="p-4 font-bold">Actor ID</th>
                <th className="p-4 font-bold">Target Entity</th>
                <th className="p-4 font-bold">Metadata</th>
                <th className="p-4 font-bold">IP Address</th>
                <th className="p-4 font-bold text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {events.map((ev) => (
                <tr key={ev.id} className="hover:bg-muted/30 transition-colors font-mono text-xs">
                  <td className="p-4">
                    <Badge variant={ev.action.startsWith("ADMIN_") ? "default" : "secondary"} className="font-bold">
                      {ev.action}
                    </Badge>
                  </td>
                  <td className="p-4 text-slate-300 max-w-[120px] truncate" title={ev.userId || "System"}>
                    {ev.userId || "System"}
                  </td>
                  <td className="p-4 text-slate-300">
                    {ev.entityType ? `${ev.entityType}:${ev.entityId?.slice(0, 8)}...` : "-"}
                  </td>
                  <td className="p-4 max-w-xs text-slate-400 truncate" title={JSON.stringify(ev.metadata)}>
                    {ev.metadata ? JSON.stringify(ev.metadata) : "-"}
                  </td>
                  <td className="p-4 text-slate-500">{ev.ipAddress || "Unknown"}</td>
                  <td className="p-4 text-right text-slate-400 font-sans text-xs">
                    {new Date(ev.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
