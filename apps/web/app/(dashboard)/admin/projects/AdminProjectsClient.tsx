"use client";

import { useState, useEffect } from "react";
import { FolderKanban, RefreshCw, Loader2, GitBranch, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  repoUrl: string | null;
  sourceType: string;
  defaultBranch: string | null;
  visibility: string;
  status: string;
  createdAt: string;
  _count: { scans: number; findings: number };
};

export function AdminProjectsClient() {
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/projects?search=${encodeURIComponent(search)}`);
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error("Failed to fetch projects", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-2">
            <FolderKanban className="w-8 h-8 text-brand" />
            Projects Metadata
          </h1>
          <p className="text-slate-400 mt-1">High-level metadata overview. Source code and tokens remain strictly protected.</p>
        </div>
        <Button onClick={fetchProjects} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" /> Refresh
        </Button>
      </div>

      <div className="flex gap-3 max-w-md">
        <Input
          placeholder="Search project name or URL..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && fetchProjects()}
        />
        <Button onClick={fetchProjects}>Search</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" /> Loading projects...
          </div>
        ) : projects.length === 0 ? (
          <div className="p-12 text-center text-slate-400">No projects found.</div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-slate-300 text-xs uppercase">
                <th className="p-4 font-bold">Project</th>
                <th className="p-4 font-bold">Source / Branch</th>
                <th className="p-4 font-bold">Visibility</th>
                <th className="p-4 font-bold">Scans</th>
                <th className="p-4 font-bold">Findings</th>
                <th className="p-4 font-bold">Status</th>
                <th className="p-4 font-bold text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border text-sm">
              {projects.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="p-4">
                    <div className="font-bold text-white">{p.name}</div>
                    <div className="text-xs text-slate-500 truncate max-w-xs">{p.description || "No description"}</div>
                  </td>
                  <td className="p-4">
                    <div className="text-xs font-mono text-slate-300 flex items-center gap-1">
                      <GitBranch className="w-3 h-3 text-slate-500" /> {p.defaultBranch || "main"}
                    </div>
                    <div className="text-[11px] text-slate-500 uppercase font-bold">{p.sourceType}</div>
                  </td>
                  <td className="p-4">
                    <Badge variant={p.visibility === "public" ? "default" : "secondary"} className="text-xs">
                      {p.visibility}
                    </Badge>
                  </td>
                  <td className="p-4 font-bold text-slate-300">{p._count.scans}</td>
                  <td className="p-4 font-bold text-amber-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" /> {p._count.findings}
                  </td>
                  <td className="p-4">
                    <Badge variant={p.status === "active" ? "default" : "outline"} className="text-xs">
                      {p.status}
                    </Badge>
                  </td>
                  <td className="p-4 text-right text-slate-400 text-xs">
                    {new Date(p.createdAt).toLocaleDateString()}
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
