"use client";

import { useMemo, useState } from "react";

type FindingItem = {
  id: number;
  severity: string;
  title: string;
  filePath: string;
  lineNumber: number;
  attackScenario: string;
  remediation: string;
  poc: string;
  codeSnippet: string;
  cvss4: number;
  confidence: number;
  vulnType?: string;
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
  const [typeQuery, setTypeQuery] = useState("");
  const [fileQuery, setFileQuery] = useState("");
  const [language, setLanguage] = useState("All");

  const filtered = useMemo(() => {
    return findings.filter((item) => {
      const severityOk = severity === "All" || item.severity === severity;
      const typeOk =
        !typeQuery ||
        (item.vulnType ?? item.title)
          .toLowerCase()
          .includes(typeQuery.toLowerCase());
      const fileOk =
        !fileQuery ||
        item.filePath.toLowerCase().includes(fileQuery.toLowerCase());
      const languageOk =
        language === "All" ||
        inferLanguage(item.filePath) === language.toLowerCase();
      return severityOk && typeOk && fileOk && languageOk;
    });
  }, [findings, severity, typeQuery, fileQuery, language]);

  return (
    <div>
      <div className="mb-4 grid gap-2 md:grid-cols-4">
        <select
          value={severity}
          onChange={(event) => setSeverity(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="All">All Severity</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <input
          value={typeQuery}
          onChange={(event) => setTypeQuery(event.target.value)}
          placeholder="Filter by vulnerability type"
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        />

        <input
          value={fileQuery}
          onChange={(event) => setFileQuery(event.target.value)}
          placeholder="Filter by file path"
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        />

        <select
          value={language}
          onChange={(event) => setLanguage(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm"
        >
          <option value="All">All Language</option>
          <option value="python">Python</option>
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
          <option value="java">Java</option>
          <option value="dotnet">.NET</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold text-slate-900">{item.title}</h3>
              <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700">
                {item.severity}
              </span>
            </div>
            <p className="text-xs text-slate-500">
              {item.filePath}:{item.lineNumber} | CVSS4 {item.cvss4} |
              Confidence {(item.confidence * 100).toFixed(0)}%
            </p>
            <pre className="mt-2 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
              {item.codeSnippet}
            </pre>
            <p className="mt-2 text-sm text-slate-700">
              Attack: {item.attackScenario}
            </p>
            <p className="mt-1 text-sm text-slate-700">PoC: {item.poc}</p>
            <p className="mt-1 text-sm text-slate-700">
              Fix: {item.remediation}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
