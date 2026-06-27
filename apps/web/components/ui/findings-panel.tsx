"use client";

import { ChevronDown, FileCode2, ExternalLink, Search, ShieldCheck, ShieldAlert, ShieldX, HelpCircle, SkipForward, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { FindingTimeline } from "./finding-timeline";
import { SeverityBadge } from "./severity-badge";
import { CodeSnippet } from "./code-snippet";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type FindingItem = {
  id: string; // Prisma uses UUIDs for Finding ID, not numbers. Wait, I should make it string.
  status: string;
  assigneeId?: string;
  severity: string;
  ruleId: string;
  scanCategory: string;
  engine: string;
  title: string;
  filePath: string;
  lineNumber: number;
  lineStart: number;
  lineEnd: number;
  source: string;
  sink: string;
  functionName: string;
  whyVulnerable: string;
  attackScenario: string;
  impact: string;
  remediation: string;
  poc: string;
  codeSnippet: string;
  evidence: string;
  pentestHint: string;
  references: string;
  cvss4: number;
  confidence: number;
  verificationStatus: string;
  dedupeHash: string;
  dataflowTrace: string;
  vulnType?: string;
  cweId?: string;
  owaspCategory?: string;
};

const severityRank: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

// Verification status badge config
const verificationConfig: Record<string, { label: string; icon: React.FC<{ className?: string }>; cls: string }> = {
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    cls: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  },
  unverified: {
    label: "Unverified",
    icon: HelpCircle,
    cls: "border-white/10 bg-white/5 text-slate-400",
  },
  needs_review: {
    label: "Needs Review",
    icon: ShieldAlert,
    cls: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  },
  false_positive_likely: {
    label: "FP Likely",
    icon: ShieldX,
    cls: "border-red-500/20 bg-red-500/10 text-red-500 line-through",
  },
  skipped: {
    label: "Skipped",
    icon: SkipForward,
    cls: "border-white/10 bg-white/5 text-slate-500",
  },
  failed: {
    label: "Verify Failed",
    icon: ShieldX,
    cls: "border-orange-500/20 bg-orange-500/10 text-orange-400",
  },
};

function inferLanguage(filePath: string): string {
  const lowered = filePath.toLowerCase();
  if (lowered.endsWith(".py")) return "python";
  if (lowered.endsWith(".ts") || lowered.endsWith(".tsx")) return "typescript";
  if (lowered.endsWith(".js") || lowered.endsWith(".jsx")) return "javascript";
  if (lowered.endsWith(".java")) return "java";
  if (lowered.endsWith(".cs")) return "dotnet";
  return "other";
}

function VerificationBadge({ status }: { status: string }) {
  const cfg = verificationConfig[status] ?? verificationConfig.unverified;
  const Icon = cfg.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold",
        cfg.cls,
      )}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function ReferenceLinks({ references }: { references: string }) {
  if (!references) return null;
  const links = references
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className="mt-3 space-y-1">
      {links.map((link) => (
        <a
          key={link}
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-brand hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {link.replace(/^https?:\/\//, "").slice(0, 60)}
        </a>
      ))}
    </div>
  );
}

export function FindingsPanel({ findings }: { findings: FindingItem[] }) {
  const [severity, setSeverity] = useState("All");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All");
  const [sortBy, setSortBy] = useState("risk");
  const [verStatus, setVerStatus] = useState("All");
  const [expanded, setExpanded] = useState<string | null>(findings[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const router = useRouter();

  const handleUpdateStatus = async (id: string, field: "status" | "verification_status", value: string) => {
    try {
      const res = await fetch(`/api/findings/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: value }),
      });
      if (res.ok) {
        router.refresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleBulkUpdate = async (status: string) => {
    if (selectedIds.size === 0) return;
    try {
      const promises = Array.from(selectedIds).map(id =>
        fetch(`/api/findings/${id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status }),
        })
      );
      await Promise.all(promises);
      setSelectedIds(new Set());
      router.refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(f => f.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const filtered = useMemo(() => {
    return findings
      .filter((item) => {
        const haystack = [
          item.title,
          item.ruleId,
          item.engine,
          item.scanCategory,
          item.vulnType,
          item.filePath,
          item.source,
          item.sink,
          item.cweId,
          item.owaspCategory,
          item.attackScenario,
          item.impact,
          item.remediation,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const severityOk = severity === "All" || item.severity === severity;
        const queryOk = !query || haystack.includes(query.toLowerCase());
        const languageOk =
          language === "All" || inferLanguage(item.filePath) === language.toLowerCase();
        const verOk = verStatus === "All" || item.verificationStatus === verStatus;
        return severityOk && queryOk && languageOk && verOk;
      })
      .sort((a, b) => {
        if (sortBy === "confidence") return b.confidence - a.confidence;
        if (sortBy === "file") return a.filePath.localeCompare(b.filePath);
        return (
          (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0) ||
          b.cvss4 - a.cvss4
        );
      });
  }, [findings, language, query, severity, sortBy, verStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [language, query, severity, sortBy, verStatus]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 grid gap-2 lg:grid-cols-[1fr_140px_140px_160px_140px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search findings…"
            className="pl-9"
          />
        </label>

        <Select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
        >
          <option value="All">All severity</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </Select>

        <Select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
        >
          <option value="All">All language</option>
          <option value="python">Python</option>
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
          <option value="dotnet">.NET</option>
          <option value="other">Other</option>
        </Select>

        <Select
          value={verStatus}
          onChange={(e) => setVerStatus(e.target.value)}
        >
          <option value="All">All status</option>
          <option value="verified">Verified</option>
          <option value="needs_review">Needs Review</option>
          <option value="unverified">Unverified</option>
          <option value="false_positive_likely">FP Likely</option>
          <option value="skipped">Skipped</option>
          <option value="failed">Verify Failed</option>
        </Select>

        <Select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="risk">Sort by risk</option>
          <option value="confidence">Sort by confidence</option>
          <option value="file">Sort by file</option>
        </Select>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <input 
            type="checkbox" 
            checked={filtered.length > 0 && selectedIds.size === filtered.length}
            onChange={toggleSelectAll}
            className="rounded border-border bg-background accent-brand"
          />
          <span>Showing {filtered.length} of {findings.length}</span>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground">{selectedIds.size} selected</span>
            <Select
              onChange={(e) => {
                if (e.target.value) handleBulkUpdate(e.target.value);
                e.target.value = "";
              }}
              className="h-8"
            >
              <option value="">Bulk actions...</option>
              <option value="false_positive">Mark as FP</option>
              <option value="accepted_risk">Mark as Accepted Risk</option>
              <option value="ignored">Mark as Ignored</option>
            </Select>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground text-center">
          No findings match the current filters.
        </div>
      ) : (
        <div className="space-y-4">
          {paginated.map((item, index) => {
            const isOpen = expanded === item.id;
            const tab = activeTab[item.id] ?? "evidence";
            const lineRange =
              item.lineStart && item.lineEnd && item.lineEnd !== item.lineStart
                ? `L${item.lineStart}-${item.lineEnd}`
                : `L${item.lineStart || item.lineNumber}`;

            return (
              <article
                key={item.id}
                className="animate-fade-up overflow-hidden rounded-xl border border-border bg-card text-card-foreground shadow-sm transition-all"
                style={{ animationDelay: `${Math.min(index * 35, 180)}ms` }}
              >
                <div className="flex w-full items-start justify-between gap-3 p-5 text-left transition hover:bg-muted/40 cursor-pointer" onClick={() => setExpanded(isOpen ? null : item.id)}>
                  <div className="pt-1" onClick={e => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(item.id)}
                      onChange={(e) => toggleSelect(item.id)}
                      className="rounded border-border bg-background accent-brand"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <SeverityBadge level={item.severity} />
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-bold text-slate-300">
                        CVSS {item.cvss4.toFixed(1)}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-bold text-slate-300">
                        {(item.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs font-bold text-slate-300">
                        {item.scanCategory}
                      </span>
                      <VerificationBadge status={item.verificationStatus} />
                      {item.cweId && (
                        <a
                          href={`https://cwe.mitre.org/data/definitions/${item.cweId.replace("CWE-", "")}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-full border border-brand/30 bg-brand/10 px-2.5 py-0.5 text-xs font-bold text-brand hover:bg-brand/20 transition-colors"
                        >
                          {item.cweId}
                        </a>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-foreground mb-1 group-hover:text-brand transition-colors">{item.title}</h3>
                    <p className="flex min-w-0 items-center gap-1.5 truncate font-mono text-xs text-muted-foreground bg-muted w-fit px-2 py-1 rounded-md border border-border">
                      <FileCode2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      {item.filePath}:{lineRange}
                    </p>
                  </div>
                  <div
                    className="p-1 hover:bg-white/10 rounded-lg transition"
                  >
                    <ChevronDown
                      className={cn(
                        "mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform duration-300",
                        isOpen && "rotate-180 text-brand",
                      )}
                    />
                  </div>
                </div>

                {/* Detail panel */}
                {isOpen && (
                  <div className="border-t border-border bg-muted/30">
                    {/* Metadata strip */}
                    <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Rule ID", item.ruleId || "unknown"],
                        ["Engine", item.engine],
                        ["Source", item.source || "not proven"],
                        ["Sink", item.sink || "not proven"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/5 p-3.5 shadow-inner">
                          <p className="text-[10px] font-bold tracking-wider uppercase text-slate-500 mb-1.5">{label}</p>
                          <p className="break-words font-mono text-xs text-slate-700 dark:text-slate-300">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Tabs */}
                    <div className="border-t border-border/50 dark:border-white/10 px-5 bg-slate-50/50 dark:bg-white/[0.02]">
                      <div className="flex gap-2 overflow-x-auto py-3">
                        {["evidence", "impact", "fix", "pentest", "triage", "references"].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setActiveTab((prev) => ({ ...prev, [item.id]: t }))}
                            className={cn(
                              "rounded-lg px-4 py-2 text-xs font-bold capitalize transition-all duration-200 border",
                              tab === t
                                ? "bg-brand/10 border-brand/50 text-brand"
                                : "bg-transparent border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                          >
                            {t === "pentest" ? "Pentest Hints" : t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="p-5">
                      {/* Evidence tab */}
                      {tab === "evidence" && (
                        <div className="space-y-5">
                          {item.evidence && (
                            <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-4 shadow-sm dark:shadow-[0_0_15px_rgba(245,158,11,0.05)]">
                              <p className="mb-2 text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
                                Evidence (redacted)
                              </p>
                              <code className="text-xs text-amber-900 dark:text-amber-200">{item.evidence}</code>
                            </div>
                          )}
                          <div className="rounded-xl overflow-hidden border border-border/50 dark:border-white/10">
                            {item.codeSnippet ? (
                              <CodeSnippet code={item.codeSnippet} language={inferLanguage(item.filePath)} />
                            ) : (
                              <div className="p-4 text-sm text-slate-500 bg-slate-100 dark:bg-black/50 text-center">No snippet available</div>
                            )}
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-4">
                              <h4 className="text-xs font-bold uppercase text-brand mb-2 flex items-center gap-1.5">
                                <HelpCircle className="w-3.5 h-3.5" /> Why vulnerable
                              </h4>
                              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {item.whyVulnerable || item.attackScenario}
                              </p>
                            </div>
                            <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-4">
                              <h4 className="text-xs font-bold uppercase text-red-600 dark:text-red-400 mb-2 flex items-center gap-1.5">
                                <ShieldAlert className="w-3.5 h-3.5" /> Attack Scenario
                              </h4>
                              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{item.attackScenario}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Impact tab */}
                      {tab === "impact" && (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-5 shadow-sm dark:shadow-[0_0_20px_rgba(239,68,68,0.1)]">
                            <h4 className="mb-2 text-xs font-bold uppercase text-red-700 dark:text-red-400 flex items-center gap-1.5">
                              <ShieldAlert className="w-4 h-4" /> Security Impact
                            </h4>
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                              {item.impact || item.attackScenario || "No impact description available."}
                            </p>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-5">
                            <h4 className="text-xs font-bold uppercase text-brand mb-2">Proof of Concept (PoC)</h4>
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-mono bg-white dark:bg-black/20 p-3 rounded-lg border border-border/50 dark:border-white/10">{item.poc || "Not provided."}</p>
                          </div>
                          {item.owaspCategory && (
                            <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-4 inline-block">
                              <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">OWASP Category</p>
                              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{item.owaspCategory}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Fix tab */}
                      {tab === "fix" && (
                        <div className="space-y-5">
                          <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-5 shadow-sm dark:shadow-[0_0_20px_rgba(16,185,129,0.1)]">
                            <h4 className="mb-2 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                              <ShieldCheck className="w-4 h-4" /> Remediation
                            </h4>
                            <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{item.remediation}</p>
                          </div>
                          {item.codeSnippet && (
                            <div>
                              <h4 className="mb-2 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 ml-1">
                                Secure Example
                              </h4>
                              {/* TODO: generate secure example */}
                              <div className="rounded-xl overflow-hidden border border-emerald-200 dark:border-emerald-500/20">
                                <CodeSnippet code={"// Provide secure implementation here based on finding"} language={inferLanguage(item.filePath)} />
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pentest Hints tab */}
                      {tab === "pentest" && (
                        <div className="space-y-4">
                          <div className="rounded-xl border border-brand/20 dark:border-brand/30 bg-brand/5 dark:bg-brand/10 p-5">
                            <h4 className="mb-3 text-xs font-bold uppercase text-brand">
                              Authorised Verification Steps
                            </h4>
                            {item.pentestHint ? (
                              <ul className="space-y-2">
                                {item.pentestHint.split("\n").filter(Boolean).map((line, i) => (
                                  <li key={i} className="flex gap-3 text-sm text-slate-700 dark:text-slate-200">
                                    <span className="shrink-0 font-bold text-brand">-&gt;</span>
                                    <span>{line.replace(/^\d+\.\s*/, "")}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-slate-400">
                                No pentest hints available for this finding.
                              </p>
                            )}
                          </div>
                          <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-4 text-xs font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4" />
                            Warning: Only perform verification steps in authorised environments using staging/test accounts.
                          </div>
                        </div>
                      )}

                      {/* Triage tab */}
                      {tab === "triage" && (
                        <div className="space-y-6">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-4">
                              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">Status</label>
                              <Select 
                                value={item.status || "open"}
                                onChange={(e) => handleUpdateStatus(item.id, "status", e.target.value)}
                              >
                                <option value="open">Open</option>
                                <option value="confirmed">Confirmed</option>
                                <option value="in_progress">In Progress</option>
                                <option value="fixed">Fixed</option>
                                <option value="accepted_risk">Accepted Risk</option>
                                <option value="false_positive">False Positive</option>
                                <option value="ignored">Ignored</option>
                                <option value="reopened">Reopened</option>
                              </Select>
                            </div>
                            <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-4">
                              <label className="block text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-2">Verification</label>
                              <Select 
                                value={item.verificationStatus || "unverified"}
                                onChange={(e) => handleUpdateStatus(item.id, "verification_status", e.target.value)}
                              >
                                <option value="unverified">Unverified</option>
                                <option value="verified">Verified</option>
                                <option value="needs_review">Needs Review</option>
                                <option value="false_positive_likely">FP Likely</option>
                                <option value="skipped">Skipped</option>
                                <option value="failed">Verify Failed</option>
                              </Select>
                            </div>
                          </div>
                          <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-5">
                            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Event Timeline</h4>
                            <FindingTimeline findingId={item.id} />
                          </div>
                        </div>
                      )}

                      {/* References tab */}
                      {tab === "references" && (
                        <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 dark:border-white/10 p-5">
                          <h4 className="mb-2 text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
                            External References
                          </h4>
                          {item.references ? (
                            <ReferenceLinks references={item.references} />
                          ) : (
                            <p className="text-sm text-slate-500">No references available.</p>
                          )}
                          {item.cweId && (
                            <div className="mt-4 pt-4 border-t border-white/10">
                              <a
                                href={`https://cwe.mitre.org/data/definitions/${item.cweId.replace("CWE-", "")}.html`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-bold text-brand hover:underline"
                              >
                                <ExternalLink className="h-4 w-4" />
                                {item.cweId} - CWE Mitre
                              </a>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">
                Page <span className="font-bold text-foreground">{currentPage}</span> of {totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
