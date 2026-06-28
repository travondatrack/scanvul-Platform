"use client";

import { useState, useEffect } from "react";
import { Building2, RefreshCw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type OrgItem = {
  id: string;
  name: string;
  slug: string;
  plan: string;
  status: string;
  createdAt: string;
  _count: { members: number; projects: number };
};

export function AdminOrganizationsClient() {
  const [orgs, setOrgs] = useState<OrgItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.organizations || []);
      }
    } catch (error) {
      console.error("Failed to fetch organizations", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <Building2 className="w-8 h-8 text-brand" />
            Organizations Metadata
          </h1>
          <p className="text-slate-400 mt-1">Overview of registered organizations, membership counts, and active plans.</p>
        </div>
        <Button onClick={fetchOrgs} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="flex gap-3 max-w-md">
        <Input
          placeholder="Search org name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchOrgs()}
        />
        <Button onClick={fetchOrgs}>Search</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading organizations...
          </div>
        ) : orgs.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No organizations found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-slate-300 text-xs uppercase">
                <th className="p-4 font-bold">Organization</th>
                <th className="p-4 font-bold">Slug</th>
                <th className="p-4 font-bold">Plan</th>
                <th className="p-4 font-bold">Members</th>
                <th className="p-4 font-bold">Projects</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {orgs.map((o) => (
                <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4 font-bold text-white">{o.name}</td>
                  <td className="p-4 font-mono text-xs text-slate-400">{o.slug}</td>
                  <td className="p-4">
                    <Badge variant="outline" className="text-xs uppercase font-bold text-brand border-brand/30">
                      {o.plan}
                    </Badge>
                  </td>
                  <td className="p-4 text-slate-300 font-bold">{o._count.members}</td>
                  <td className="p-4 text-slate-300 font-bold">{o._count.projects}</td>
                  <td className="p-4">
                    <Badge variant={o.status === "active" ? "default" : "secondary"} className="text-xs">
                      {o.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right text-slate-400 text-xs">
                    {new Date(o.createdAt).toLocaleDateString()}
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
