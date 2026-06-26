"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Github, Loader2 } from "lucide-react";

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [githubUrl, setGithubUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [organizations, setOrganizations] = useState<Array<{ id: string; name: string; members?: Array<{ role: string }> }>>([]);

  useEffect(() => {
    fetch("/api/organizations", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { items: [] }))
      .then((data) => setOrganizations(data.items ?? []))
      .catch(() => setOrganizations([]));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, githubUrl, organizationId: organizationId || undefined }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      router.push(`/projects/${data.id}`);
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto mt-12">
      <div className="bg-white dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800/50 dark:backdrop-blur-xl rounded-2xl p-8 shadow-sm dark:shadow-xl">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Create New Project</h1>
        <p className="text-slate-500 dark:text-zinc-400 mb-8">Link a GitHub repository to start scanning for vulnerabilities and secrets.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400 p-3 rounded-xl text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Project Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Secure App"
              className="w-full bg-white dark:bg-zinc-950/50 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/50 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600 shadow-sm"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">GitHub Repository URL</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Github className="h-5 w-5 text-slate-400 dark:text-zinc-500" />
              </div>
              <input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="w-full bg-white dark:bg-zinc-950/50 border border-slate-300 dark:border-white/10 rounded-xl pl-12 pr-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/50 transition-all placeholder:text-slate-400 dark:placeholder:text-zinc-600 shadow-sm"
                required
              />
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-500">Currently only public repositories are supported without PAT.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-zinc-300">Workspace</label>
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="w-full bg-white dark:bg-zinc-950/50 border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-slate-900 dark:text-white focus:outline-none focus:border-brand/60 focus:ring-1 focus:ring-brand/50 transition-all shadow-sm"
            >
              <option value="">Personal</option>
              {organizations
                .filter((org) => ["owner", "admin"].includes(org.members?.[0]?.role ?? ""))
                .map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 dark:text-zinc-400 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="bg-brand hover:opacity-90 text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm dark:shadow-lg dark:shadow-brand/20 active:scale-95 disabled:opacity-50 flex items-center space-x-2"
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? "Creating..." : "Create Project"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
