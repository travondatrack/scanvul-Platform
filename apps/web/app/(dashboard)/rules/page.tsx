"use client";

import { Database, FileCode2, Loader2, Save, ShieldAlert, Sliders } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";

const ENGINE_META = [
  { id: "semgrep", name: "Semgrep SAST", description: "Static source analysis for injection, XSS, SSRF, and custom taint rules.", icon: FileCode2, ruleset: "Default + Custom Taint" },
  { id: "bandit", name: "Bandit Python", description: "Python security checks for dangerous APIs and unsafe patterns.", icon: FileCode2, ruleset: "Bandit built-ins" },
  { id: "eslint", name: "ESLint Security", description: "JavaScript and TypeScript security lint checks.", icon: FileCode2, ruleset: "eslint-plugin-security" },
  { id: "owasp", name: "OWASP Patterns", description: "Framework-independent checks mapped to common OWASP categories.", icon: ShieldAlert, ruleset: "ScanVul patterns" },
  { id: "trivy", name: "Trivy Dependencies", description: "Dependency and package vulnerability checks.", icon: Database, ruleset: "Trivy vulnerability DB" },
  { id: "secrets", name: "Secret Scanner", description: "Detect exposed credentials, tokens, keys, and secrets.", icon: Database, ruleset: "ScanVul signatures" },
];

type Project = { id: string; name: string; organization?: { name: string } | null };
type Policy = {
  projectId: string;
  enabledEngines: string[];
  severityThreshold: string;
  ruleOverrides: Record<string, unknown>;
  aiTriageEnabled: boolean;
  secretVerificationEnabled: boolean;
};

export default function RulesPoliciesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data) => {
        const items = data.items ?? [];
        setProjects(items);
        setProjectId(items[0]?.id ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!projectId) {
      setPolicy(null);
      return;
    }
    setLoading(true);
    fetch(`/api/scanner-policy?projectId=${projectId}`)
      .then((res) => res.json())
      .then((data) => setPolicy(data))
      .finally(() => setLoading(false));
  }, [projectId]);

  const enabled = useMemo(() => new Set(policy?.enabledEngines ?? []), [policy]);

  function toggleEngine(id: string) {
    if (!policy) return;
    const next = new Set(policy.enabledEngines);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPolicy({ ...policy, enabledEngines: Array.from(next) });
  }

  async function savePolicy() {
    if (!policy) return;
    setSaving(true);
    setMessage("");
    try {
      const res = await fetch("/api/scanner-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save policy");
      setPolicy(data);
      setMessage("Policy saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save policy");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto mt-4">
      <PageHeader title="ScanVul Rules" description="Configure scanner policy per project." />

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="grid gap-1.5">
            <span className="text-xs font-bold uppercase text-muted-foreground">Project</span>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}{project.organization?.name ? ` - ${project.organization.name}` : ""}
                </option>
              ))}
            </Select>
          </label>
          <Button onClick={savePolicy} disabled={!policy || saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Policy
          </Button>
        </div>
        {message && <p className="mt-3 text-sm text-muted-foreground">{message}</p>}
      </Card>

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
          Loading policy...
        </Card>
      ) : !policy ? (
        <Card className="p-8 text-center text-muted-foreground">Create a project before configuring scan rules.</Card>
      ) : (
        <>
          <div className="space-y-4">
            {ENGINE_META.map((engine) => {
              const Icon = engine.icon;
              const isEnabled = enabled.has(engine.id);
              return (
                <Card key={engine.id} className="flex items-start space-x-6 p-6 transition-colors hover:border-brand/30">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 ${isEnabled ? "bg-brand/10 text-brand" : "bg-muted text-muted-foreground"}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xl font-bold text-foreground">{engine.name}</h3>
                      <button
                        onClick={() => toggleEngine(engine.id)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-ring/40 ${isEnabled ? "bg-brand" : "bg-muted"}`}
                        aria-label={`Toggle ${engine.name}`}
                      >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform ${isEnabled ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                    <p className="text-muted-foreground text-sm mb-4">{engine.description}</p>
                    <div className="flex items-center space-x-2 text-xs font-medium">
                      <span className="text-muted-foreground">Ruleset:</span>
                      <Badge variant="secondary" className="gap-1 rounded-md">
                        <Sliders className="w-3 h-3" />
                        <span>{engine.ruleset}</span>
                      </Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>

          <Card className="p-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="grid gap-1.5">
                <span className="text-xs font-bold uppercase text-muted-foreground">Severity Threshold</span>
                <Select value={policy.severityThreshold} onChange={(e) => setPolicy({ ...policy, severityThreshold: e.target.value })}>
                  {["Info", "Low", "Medium", "High", "Critical"].map((severity) => (
                    <option key={severity} value={severity}>{severity}</option>
                  ))}
                </Select>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-border p-3">
                <input type="checkbox" checked={policy.aiTriageEnabled} onChange={(e) => setPolicy({ ...policy, aiTriageEnabled: e.target.checked })} />
                <span className="text-sm font-semibold">AI triage</span>
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-border p-3">
                <input type="checkbox" checked={policy.secretVerificationEnabled} onChange={(e) => setPolicy({ ...policy, secretVerificationEnabled: e.target.checked })} />
                <span className="text-sm font-semibold">Secret verification</span>
              </label>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
