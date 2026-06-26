"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Github, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

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
      <Card className="p-8">
        <h1 className="text-2xl font-bold text-foreground mb-2">Create New Project</h1>
        <p className="text-muted-foreground mb-8">Link a GitHub repository to start scanning for vulnerabilities and secrets.</p>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Project Name</label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. My Secure App"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">GitHub Repository URL</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Github className="h-5 w-5 text-muted-foreground" />
              </div>
              <Input
                type="url"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                placeholder="https://github.com/username/repo"
                className="pl-12"
                required
              />
            </div>
            <p className="text-xs text-muted-foreground">Currently only public repositories are supported without PAT.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Workspace</label>
            <Select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
            >
              <option value="">Personal</option>
              {organizations
                .filter((org) => ["owner", "admin"].includes(org.members?.[0]?.role ?? ""))
                .map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
            </Select>
          </div>

          <div className="pt-4 flex items-center justify-end space-x-4">
            <Button
              type="button"
              onClick={() => router.back()}
              variant="ghost"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
            >
              {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isLoading ? "Creating..." : "Create Project"}</span>
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
