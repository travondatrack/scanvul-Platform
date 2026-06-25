"use client";

import { ChevronDown, FileCode2, ExternalLink, Search, ShieldCheck, ShieldAlert, ShieldX, HelpCircle, SkipForward } from "lucide-react";
import { useMemo, useState } from "react";

import { cn } from "@/lib/utils";

type FindingItem = {
  id: number;
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

const severityTone: Record<string, string> = {
  Critical: "border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400",
  High: "border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10 text-orange-700 dark:text-orange-400",
  Medium: "border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  Low: "border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

// Verification status badge config
const verificationConfig: Record<string, { label: string; icon: React.FC<{ className?: string }>; cls: string }> = {
  verified: {
    label: "Verified",
    icon: ShieldCheck,
    cls: "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
  unverified: {
    label: "Unverified",
    icon: HelpCircle,
    cls: "border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400",
  },
  needs_review: {
    label: "Needs Review",
    icon: ShieldAlert,
    cls: "border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  false_positive_likely: {
    label: "FP Likely",
    icon: ShieldX,
    cls: "border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 line-through",
  },
  skipped: {
    label: "Skipped",
    icon: SkipForward,
    cls: "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500",
  },
  failed: {
    label: "Verify Failed",
    icon: ShieldX,
    cls: "border-orange-200 dark:border-orange-500/20 bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400",
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
  const [expanded, setExpanded] = useState<number | null>(findings[0]?.id ?? null);
  const [activeTab, setActiveTab] = useState<Record<number, string>>({});

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

  return (
    <div>
      {/* Filters */}
      <div className="mb-4 grid gap-2 lg:grid-cols-[1fr_140px_140px_160px_140px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search findings…"
            className="h-10 w-full rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-9 pr-3 text-sm text-slate-900 dark:text-white outline-none transition focus:border-slate-900 dark:focus:border-white focus:ring-4 focus:ring-slate-200 dark:focus:ring-zinc-800"
          />
        </label>

        <select
          value={severity}
          onChange={(e) => setSeverity(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-2 text-sm"
        >
          <option value="All">All severity</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-2 text-sm"
        >
          <option value="All">All language</option>
          <option value="python">Python</option>
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
          <option value="dotnet">.NET</option>
          <option value="other">Other</option>
        </select>

        <select
          value={verStatus}
          onChange={(e) => setVerStatus(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-2 text-sm"
        >
          <option value="All">All status</option>
          <option value="verified">Verified</option>
          <option value="needs_review">Needs Review</option>
          <option value="unverified">Unverified</option>
          <option value="false_positive_likely">FP Likely</option>
          <option value="skipped">Skipped</option>
          <option value="failed">Verify Failed</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="h-10 rounded-lg border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-slate-900 dark:text-white px-2 text-sm"
        >
          <option value="risk">Sort by risk</option>
          <option value="confidence">Sort by confidence</option>
          <option value="file">Sort by file</option>
        </select>
      </div>

      <div className="mb-3 text-sm text-slate-600 dark:text-zinc-400">
        Showing {filtered.length} of {findings.length}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-5 text-sm text-slate-500 dark:text-zinc-400">
          No findings match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, index) => {
            const isOpen = expanded === item.id;
            const tab = activeTab[item.id] ?? "evidence";
            const lineRange =
              item.lineStart && item.lineEnd && item.lineEnd !== item.lineStart
                ? `L${item.lineStart}–${item.lineEnd}`
                : `L${item.lineStart || item.lineNumber}`;

            return (
              <article
                key={item.id}
                className="animate-fade-up overflow-hidden rounded-lg border border-slate-200 dark:border-zinc-800/50 bg-white dark:bg-zinc-900/50 shadow-sm dark:shadow-xl dark:backdrop-blur-md"
                style={{ animationDelay: `${Math.min(index * 35, 180)}ms` }}
              >
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-slate-50 dark:hover:bg-zinc-800/30"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs font-semibold",
                          severityTone[item.severity] ?? "border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400",
                        )}
                      >
                        {item.severity}
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                        CVSS {item.cvss4.toFixed(1)}
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                        {(item.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="rounded-full bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-zinc-400">
                        {item.scanCategory}
                      </span>
                      <VerificationBadge status={item.verificationStatus} />
                      {item.cweId && (
                        <a
                          href={`https://cwe.mitre.org/data/definitions/${item.cweId.replace("CWE-", "")}.html`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-full border border-brand/20 dark:border-brand/30 bg-brand/10 dark:bg-brand/20 px-2 py-0.5 text-xs font-semibold text-brand hover:bg-brand/20 dark:hover:bg-brand/30"
                        >
                          {item.cweId}
                        </a>
                      )}
                    </div>
                    <h3 className="font-semibold text-slate-950 dark:text-white">{item.title}</h3>
                    <p className="mt-1 flex min-w-0 items-center gap-1 truncate font-mono text-xs text-slate-500 dark:text-zinc-400">
                      <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                      {item.filePath}:{lineRange}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-5 w-5 shrink-0 text-slate-400 dark:text-zinc-500 transition",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {/* Detail panel */}
                {isOpen && (
                  <div className="border-t border-slate-200 dark:border-zinc-800/50">
                    {/* Metadata strip */}
                    <div className="grid gap-2 p-4 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Rule ID", item.ruleId || "unknown"],
                        ["Engine", item.engine],
                        ["Source", item.source || "not proven"],
                        ["Sink", item.sink || "not proven"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg bg-slate-50 dark:bg-zinc-800/50 p-3">
                          <p className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-500">{label}</p>
                          <p className="mt-1 break-words font-mono text-xs text-slate-800 dark:text-zinc-300">{value}</p>
                        </div>
                      ))}
                    </div>

                    {/* Tabs */}
                    <div className="border-t border-slate-100 dark:border-zinc-800/50 px-4">
                      <div className="flex gap-1 overflow-x-auto py-2">
                        {["evidence", "impact", "fix", "pentest", "references"].map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setActiveTab((prev) => ({ ...prev, [item.id]: t }))}
                            className={cn(
                              "rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition",
                              tab === t
                                ? "bg-slate-900 dark:bg-brand text-white"
                                : "text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-zinc-800",
                            )}
                          >
                            {t === "pentest" ? "Pentest Hints" : t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="px-4 pb-4">
                      {/* Evidence tab */}
                      {tab === "evidence" && (
                        <div className="space-y-3">
                          {item.evidence && (
                            <div className="rounded-lg border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-3">
                              <p className="mb-1 text-xs font-bold uppercase text-amber-700 dark:text-amber-500">
                                Evidence (redacted)
                              </p>
                              <code className="text-xs text-amber-900 dark:text-amber-400">{item.evidence}</code>
                            </div>
                          )}
                          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 dark:bg-[#0d1117] p-3 text-xs text-slate-100">
                            {item.codeSnippet || "No snippet available"}
                          </pre>
                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-500">
                                Why vulnerable
                              </h4>
                              <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">
                                {item.whyVulnerable || item.attackScenario}
                              </p>
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-500">Attack</h4>
                              <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">{item.attackScenario}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Impact tab */}
                      {tab === "impact" && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-red-100 dark:border-red-500/20 bg-red-50 dark:bg-red-500/5 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-red-700 dark:text-red-500">
                              Security Impact
                            </h4>
                            <p className="text-sm text-red-900 dark:text-red-400">
                              {item.impact || item.attackScenario || "No impact description available."}
                            </p>
                          </div>
                          <div>
                            <h4 className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-500">PoC</h4>
                            <p className="mt-1 text-sm text-slate-700 dark:text-zinc-300">{item.poc}</p>
                          </div>
                          {item.owaspCategory && (
                            <div className="rounded-lg bg-slate-50 dark:bg-zinc-800/50 p-3">
                              <p className="text-xs font-bold uppercase text-slate-500 dark:text-zinc-500">OWASP</p>
                              <p className="mt-1 text-xs font-mono text-slate-700 dark:text-zinc-300">{item.owaspCategory}</p>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Fix tab */}
                      {tab === "fix" && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-emerald-100 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/5 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-500">
                              Remediation
                            </h4>
                            <p className="text-sm text-emerald-900 dark:text-emerald-400">{item.remediation}</p>
                          </div>
                          {item.codeSnippet && (
                            <div>
                              <h4 className="mb-1 text-xs font-bold uppercase text-slate-500 dark:text-zinc-500">
                                Secure Example
                              </h4>
                              <pre className="overflow-auto rounded-lg bg-slate-950 dark:bg-[#0d1117] p-3 text-xs text-emerald-300 dark:text-emerald-400">
                                {/* secureExample from parent – passed via findings */}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Pentest Hints tab */}
                      {tab === "pentest" && (
                        <div className="space-y-3">
                          <div className="rounded-lg border border-brand/20 bg-brand/5 p-4">
                            <h4 className="mb-2 text-xs font-bold uppercase text-brand">
                              Authorised Verification Steps
                            </h4>
                            {item.pentestHint ? (
                              <ul className="space-y-1">
                                {item.pentestHint.split("\n").filter(Boolean).map((line, i) => (
                                  <li key={i} className="flex gap-2 text-sm text-slate-800 dark:text-zinc-300">
                                    <span className="mt-0.5 shrink-0 font-bold text-brand">→</span>
                                    <span>{line.replace(/^\d+\.\s*/, "")}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-sm text-slate-500 dark:text-zinc-500">
                                No pentest hints available for this finding.
                              </p>
                            )}
                          </div>
                          <div className="rounded-lg border border-amber-100 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-500">
                            ⚠️ Only perform verification steps in authorised environments using staging/test accounts.
                          </div>
                        </div>
                      )}

                      {/* References tab */}
                      {tab === "references" && (
                        <div>
                          <h4 className="mb-2 text-xs font-bold uppercase text-slate-500 dark:text-zinc-500">
                            External References
                          </h4>
                          {item.references ? (
                            <ReferenceLinks references={item.references} />
                          ) : (
                            <p className="text-sm text-slate-500 dark:text-zinc-500">No references available.</p>
                          )}
                          {item.cweId && (
                            <div className="mt-3">
                              <a
                                href={`https://cwe.mitre.org/data/definitions/${item.cweId.replace("CWE-", "")}.html`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline"
                              >
                                <ExternalLink className="h-4 w-4" />
                                {item.cweId} – CWE Mitre
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
        </div>
      )}
    </div>
  );
}
