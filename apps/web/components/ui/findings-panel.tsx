"use client";

import { ChevronDown, FileCode2, Search } from "lucide-react";
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
  source: string;
  sink: string;
  functionName: string;
  whyVulnerable: string;
  attackScenario: string;
  remediation: string;
  poc: string;
  codeSnippet: string;
  cvss4: number;
  confidence: number;
  vulnType?: string;
};

const severityRank: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};

const severityTone: Record<string, string> = {
  Critical: "border-red-200 bg-red-50 text-red-700",
  High: "border-orange-200 bg-orange-50 text-orange-700",
  Medium: "border-amber-200 bg-amber-50 text-amber-700",
  Low: "border-emerald-200 bg-emerald-50 text-emerald-700",
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

export function FindingsPanel({ findings }: { findings: FindingItem[] }) {
  const [severity, setSeverity] = useState("All");
  const [query, setQuery] = useState("");
  const [language, setLanguage] = useState("All");
  const [sortBy, setSortBy] = useState("risk");
  const [expanded, setExpanded] = useState<number | null>(findings[0]?.id ?? null);

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
          item.attackScenario,
          item.remediation,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        const severityOk = severity === "All" || item.severity === severity;
        const queryOk = !query || haystack.includes(query.toLowerCase());
        const languageOk =
          language === "All" ||
          inferLanguage(item.filePath) === language.toLowerCase();
        return severityOk && queryOk && languageOk;
      })
      .sort((a, b) => {
        if (sortBy === "confidence") {
          return b.confidence - a.confidence;
        }
        if (sortBy === "file") {
          return a.filePath.localeCompare(b.filePath);
        }
        return (
          (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0) ||
          b.cvss4 - a.cvss4
        );
      });
  }, [findings, language, query, severity, sortBy]);

  return (
    <div>
      <div className="mb-4 grid gap-2 lg:grid-cols-[1fr_160px_160px_160px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search findings"
            className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
          />
        </label>

        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
        >
          <option value="All">All severity</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
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
          value={sortBy}
          onChange={(event) => setSortBy(event.target.value)}
          className="h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm"
        >
          <option value="risk">Sort by risk</option>
          <option value="confidence">Sort by confidence</option>
          <option value="file">Sort by file</option>
        </select>
      </div>

      <div className="mb-3 text-sm text-slate-600">
        Showing {filtered.length} of {findings.length}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">
          No findings match the current filters.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((item, index) => {
            const isOpen = expanded === item.id;
            return (
              <article
                key={item.id}
                className="animate-fade-up overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
                style={{ animationDelay: `${Math.min(index * 35, 180)}ms` }}
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : item.id)}
                  className="flex w-full items-start justify-between gap-3 p-4 text-left transition hover:bg-slate-50"
                >
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs font-semibold",
                          severityTone[item.severity] ?? "border-slate-200 bg-slate-50 text-slate-600",
                        )}
                      >
                        {item.severity}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        CVSS {item.cvss4.toFixed(1)}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {(item.confidence * 100).toFixed(0)}%
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {item.scanCategory}
                      </span>
                    </div>
                    <h3 className="font-semibold text-slate-950">{item.title}</h3>
                    <p className="mt-1 flex min-w-0 items-center gap-1 truncate font-mono text-xs text-slate-500">
                      <FileCode2 className="h-3.5 w-3.5 shrink-0" />
                      {item.filePath}:{item.lineNumber}
                    </p>
                  </div>
                  <ChevronDown
                    className={cn(
                      "mt-1 h-5 w-5 shrink-0 text-slate-400 transition",
                      isOpen && "rotate-180",
                    )}
                  />
                </button>

                {isOpen ? (
                  <div className="border-t border-slate-200 p-4">
                    <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                      {[
                        ["Rule ID", item.ruleId || "unknown"],
                        ["Engine", item.engine],
                        ["Source", item.source || "not proven"],
                        ["Sink", item.sink || "not proven"],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg bg-slate-50 p-3">
                          <p className="text-xs font-bold uppercase text-slate-500">
                            {label}
                          </p>
                          <p className="mt-1 break-words font-mono text-xs text-slate-800">
                            {value}
                          </p>
                        </div>
                      ))}
                    </div>
                    <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                      {item.codeSnippet || "No snippet available"}
                    </pre>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <h4 className="text-xs font-bold uppercase text-slate-500">
                          Why vulnerable
                        </h4>
                        <p className="mt-1 text-sm text-slate-700">
                          {item.whyVulnerable || item.attackScenario}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase text-slate-500">
                          Attack
                        </h4>
                        <p className="mt-1 text-sm text-slate-700">
                          {item.attackScenario}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase text-slate-500">
                          PoC
                        </h4>
                        <p className="mt-1 text-sm text-slate-700">{item.poc}</p>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase text-slate-500">
                          Fix
                        </h4>
                        <p className="mt-1 text-sm text-slate-700">
                          {item.remediation}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
