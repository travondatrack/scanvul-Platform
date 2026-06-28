"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, CheckCircle, AlertTriangle, RefreshCw, 
  ShieldCheck, ShieldAlert, FileCode2, ChevronLeft, ChevronRight,
  HelpCircle, ShieldX, SkipForward, ExternalLink, Activity, Copy, Sparkles
} from "lucide-react";
import { SeverityBadge } from "./severity-badge";
import { CodeSnippet } from "./code-snippet";
import { ScanActions } from "./scan-actions";
import { FindingTimeline } from "./finding-timeline";
import { ScanTimeline } from "./scan-timeline";
import { cn } from "@/lib/utils";

export type FindingItem = {
  id: string;
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
  secureExample?: string;
  codeLink?: string | null;
  references: string;
  cvss4: number;
  confidence: number;
  verificationStatus: string;
  dedupeHash: string;
  dataflowTrace: string;
  vulnType?: string;
  cweId?: string;
  owaspCategory?: string;
  previouslyFalsePositive?: boolean;
};

const severityRank: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
  Info: 0,
};

type AiReview = {
  isLikelyTruePositive?: boolean;
  confidence?: number;
  explanation?: string;
  suggestedFix?: string;
  secureCodeExample?: string;
  pentestSuggestion?: string;
};

function buildPentestGuidance(finding: FindingItem) {
  if (finding.pentestHint?.trim()) return finding.pentestHint;
  const blob = `${finding.vulnType} ${finding.title} ${finding.cweId} ${finding.owaspCategory}`.toLowerCase();
  if (blob.includes("sql")) {
    return "Goal: confirm whether user-controlled input reaches a SQL query. Manual check: use a staging account and submit harmless quote/control characters, then compare validation and error handling. Safe payload sample: ' OR '1'='1 against a non-production test record only. Expected behavior: parameterized query rejects or treats input as data. False-positive signs: input is normalized before the query or only appears in a constant query path. Do not dump data or alter records.";
  }
  if (blob.includes("xss") || blob.includes("cross-site")) {
    return "Goal: confirm whether input is rendered as executable HTML/JavaScript. Manual check: use a harmless marker payload in staging and inspect rendered output. Safe payload sample: <script>alert(1)</script> or an encoded marker. Expected behavior: output is escaped or sanitized. False-positive signs: the value is displayed as text or sanitized by a trusted renderer. Do not target real users.";
  }
  if (blob.includes("ssrf")) {
    return "Goal: confirm whether the server can be forced to fetch attacker-controlled URLs. Manual check: point the parameter to an authorized callback endpoint in staging. Expected behavior: allowlist blocks unknown hosts and private ranges. False-positive signs: URL is never fetched server-side or strict allowlist is enforced. Do not probe internal production networks.";
  }
  if (blob.includes("secret") || blob.includes("credential")) {
    return "Goal: determine whether the exposed value is real and still active. Manual check: rotate the secret first when possible, then validate metadata through the owning provider with least-privilege tooling. Expected behavior: secrets are revoked and moved to a vault. False-positive signs: placeholder/test token pattern or revoked credential. Do not use the secret to access data.";
  }
  return "Goal: validate exploitability in an authorized staging environment. Manual check: trace source-to-sink reachability, confirm whether attacker-controlled input can influence the vulnerable operation, and compare behavior before/after a safe guardrail. Expected behavior: validation, escaping, authorization, or safe API usage prevents impact. False-positive signs: unreachable code, sanitized input, or framework protection. Do not perform destructive actions.";
}

function copyText(value: string) {
  if (!value) return;
  void navigator.clipboard?.writeText(value);
}

const verificationConfig: Record<string, { label: string; icon: any; cls: string }> = {
  verified: { label: "Verified", icon: ShieldCheck, cls: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400" },
  unverified: { label: "Unverified", icon: HelpCircle, cls: "border-white/10 bg-white/5 text-slate-400" },
  needs_review: { label: "Needs Review", icon: ShieldAlert, cls: "border-amber-500/20 bg-amber-500/10 text-amber-400" },
  false_positive_likely: { label: "FP Likely", icon: ShieldX, cls: "border-red-500/20 bg-red-500/10 text-red-500 line-through" },
  skipped: { label: "Skipped", icon: SkipForward, cls: "border-white/10 bg-white/5 text-slate-500" },
  failed: { label: "Verify Failed", icon: ShieldX, cls: "border-orange-500/20 bg-orange-500/10 text-orange-400" },
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
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", cfg.cls)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

function AssigneeSelect({ finding }: { finding: FindingItem }) {
  const router = useRouter();
  const [items, setItems] = useState<Array<{ id: string; name: string | null; email: string | null }>>([]);
  const [value, setValue] = useState(finding.assigneeId ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/findings/${finding.id}/assignees`)
      .then((res) => res.ok ? res.json() : { items: [] })
      .then((data) => {
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [finding.id]);

  async function updateAssignee(nextValue: string) {
    setValue(nextValue);
    setLoading(true);
    try {
      const res = await fetch(`/api/findings/${finding.id}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: nextValue || null }),
      });
      if (!res.ok) {
        setValue(finding.assigneeId ?? "");
        return;
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <select
      value={value}
      onChange={(e) => updateAssignee(e.target.value)}
      disabled={loading}
      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-brand disabled:opacity-60"
    >
      <option value="">Unassigned</option>
      {items.map((item) => (
        <option key={item.id} value={item.id}>
          {item.name || item.email || item.id}
        </option>
      ))}
    </select>
  );
}

export function TriageDashboard({ 
  scan, 
  findings, 
  stats 
}: { 
  scan: any; 
  findings: FindingItem[];
  stats: { critical: number; high: number; medium: number; low: number; info?: number; total: number; riskScore: number };
}) {
  const [activeTab, setActiveTab] = useState("All");
  const [verStatusFilter, setVerStatusFilter] = useState("All");
  const [langFilter, setLangFilter] = useState("All");
  const [hidePreviousFp, setHidePreviousFp] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(findings[0]?.id || null);
  const [detailTab, setDetailTab] = useState("evidence");
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
  const [aiReason, setAiReason] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReview, setAiReview] = useState<AiReview | null>(null);
  const [aiError, setAiError] = useState("");
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const isRunning = scan.status === "queued" || scan.status === "running";
  
  const router = useRouter();
  const prevStatus = useRef(scan.status);

  const updateFinding = async (id: string, payload: Record<string, string>) => {
    const res = await fetch(`/api/findings/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) router.refresh();
  };

  // Auto-refresh when scan is running
  useEffect(() => {
    if (isRunning) {
      const interval = setInterval(() => {
        router.refresh();
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isRunning, router]);

  // Show popup when scan transitions to completed or failed
  useEffect(() => {
    if ((prevStatus.current === "queued" || prevStatus.current === "running") && scan.status === "completed") {
      alert("✅ Quá trình Scan đã hoàn tất!");
    } else if ((prevStatus.current === "queued" || prevStatus.current === "running") && scan.status === "failed") {
      alert("❌ Quá trình Scan thất bại. Vui lòng kiểm tra lại logs.");
    }
    prevStatus.current = scan.status;
  }, [scan.status]);

  // Filtering
  const filtered = useMemo(() => {
    return findings
      .filter((f) => {
        const sevOk = activeTab === "All" || f.severity.toLowerCase() === activeTab.toLowerCase();
        const verOk = verStatusFilter === "All" || f.verificationStatus === verStatusFilter;
        const langOk = langFilter === "All" || inferLanguage(f.filePath) === langFilter.toLowerCase();
        const fpOk = !hidePreviousFp || !f.previouslyFalsePositive;
        return sevOk && verOk && langOk && fpOk;
      })
      .sort((a, b) => {
        return (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0) || b.cvss4 - a.cvss4;
      });
  }, [findings, activeTab, verStatusFilter, langFilter, hidePreviousFp]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, verStatusFilter, langFilter, hidePreviousFp]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const selectedFinding = useMemo(() => findings.find(f => f.id === selectedId), [findings, selectedId]);

  useEffect(() => {
    if (!selectedFinding) return;
    let cancelled = false;
    setAiReview(null);
    setAiError("");
    setAiAvailable(null);
    fetch(`/api/findings/${selectedFinding.id}/ai-review`)
      .then((res) => res.ok ? res.json() : { available: false, reason: "AI review unavailable." })
      .then((data) => {
        if (!cancelled) {
          setAiAvailable(Boolean(data.available));
          setAiReason(data.reason || "");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAiAvailable(false);
          setAiReason("AI review unavailable.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selectedFinding?.id]);

  async function runAiReview() {
    if (!selectedFinding) return;
    setAiLoading(true);
    setAiError("");
    try {
      const res = await fetch(`/api/findings/${selectedFinding.id}/ai-review`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "AI review failed");
      setAiReview(data.review);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI review failed");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300 relative flex flex-col">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_-20%,rgba(0,201,232,0.08),transparent_40%)]" />
      
      {/* 1. STICKY HEADER */}
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-xl border-b border-border shadow-sm">
        <div className="w-full px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href={`/projects/${scan.projectId || ""}`}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/50 text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex flex-col">
              <h1 className="text-lg font-bold leading-tight flex items-center gap-2">
                Scan Report
                <span className="text-muted-foreground font-normal text-sm">/ {(scan.sourceType === "repo_url" || scan.sourceType === "github") ? scan.sourceValue : "Code Snippet"}</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-xs ${
              scan.status === "completed" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
              scan.status === "failed" ? "bg-red-500/10 text-red-400 border border-red-500/20" :
              "bg-brand/10 text-brand border border-brand/20 animate-pulse"
            }`}>
              {scan.status === "completed" && <CheckCircle className="w-3.5 h-3.5" />}
              {scan.status === "failed" && <AlertTriangle className="w-3.5 h-3.5" />}
              {isRunning && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span className="capitalize">{scan.status}</span>
            </div>
            
            {isRunning && (
              <a href={`/scan/${scan.id}`} className="bg-muted/40 border border-border hover:bg-muted px-3 py-1.5 rounded-lg text-xs font-bold transition-all">
                Refresh
              </a>
            )}
            
            {scan.status === "completed" && (
              <ScanActions 
                scanId={scan.id} 
                initialBadgeUrl={scan.badges?.[0] ? `/api/public/badge/${scan.badges[0].token}` : null} 
              />
            )}
          </div>
        </div>
      </header>

      {/* 2. SUMMARY BAR */}
      <div className="border-b border-border bg-card/30 backdrop-blur-md">
        <div className="w-full px-6 py-4 flex items-center gap-6 overflow-x-auto">
          {/* Risk Score */}
          <div className="flex items-center gap-3 pr-6 border-r border-border shrink-0">
            <div className="relative w-12 h-12 flex items-center justify-center rounded-full bg-muted border border-border">
              <span className="text-xs font-black">{stats.riskScore.toFixed(0)}</span>
              <svg className="absolute inset-0 w-full h-full -rotate-90 rounded-full" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-muted/30" strokeWidth="3"></circle>
                <circle cx="18" cy="18" r="16" fill="none" className="stroke-brand" strokeWidth="3" strokeDasharray={`${stats.riskScore}, 100`}></circle>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Risk Score</span>
              <span className="text-sm font-bold">{scan.riskLevel}</span>
            </div>
          </div>
          
          {/* Severity Pills */}
          <div className="flex gap-3 shrink-0">
            {[
              { label: 'Critical', count: stats.critical, color: 'text-rose-500', bg: 'bg-rose-500' },
              { label: 'High', count: stats.high, color: 'text-orange-500', bg: 'bg-orange-500' },
              { label: 'Medium', count: stats.medium, color: 'text-amber-500', bg: 'bg-amber-500' },
              { label: 'Low', count: stats.low, color: 'text-emerald-500', bg: 'bg-emerald-500' },
              { label: 'Info', count: stats.info ?? 0, color: 'text-sky-500', bg: 'bg-sky-500' },
            ].map(sev => (
              <button 
                key={sev.label}
                onClick={() => setActiveTab(activeTab === sev.label ? 'All' : sev.label)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                  activeTab === sev.label 
                    ? `border-${sev.color.split('-')[1]}-500/50 bg-${sev.color.split('-')[1]}-500/10` 
                    : 'border-border bg-card hover:bg-muted'
                }`}
              >
                <div className={`w-2 h-2 rounded-full ${sev.bg}`} />
                <span className="text-sm font-semibold">{sev.label}</span>
                <span className={`text-sm font-bold ${sev.color}`}>{sev.count}</span>
              </button>
            ))}
          </div>

          <div className="ml-auto shrink-0 text-sm text-muted-foreground font-medium">
            Total Findings: <span className="text-foreground font-bold">{stats.total}</span>
          </div>
        </div>
      </div>

      {/* 3. THREE-COLUMN BODY */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* LEFT SIDEBAR: Filters */}
        <div className="w-[240px] shrink-0 border-r border-border bg-card/20 p-4 flex flex-col gap-6 overflow-y-auto hidden md:flex">
          <div>
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">Severity</h3>
            <div className="flex flex-col gap-1">
              <button onClick={() => setActiveTab('All')} className={cn("text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors", activeTab === 'All' ? "bg-brand/10 text-brand" : "hover:bg-muted")}>
                All Findings
              </button>
              {['Critical', 'High', 'Medium', 'Low'].map(s => (
                <button key={s} onClick={() => setActiveTab(s)} className={cn("text-left px-3 py-2 rounded-lg text-sm font-semibold transition-colors", activeTab === s ? "bg-brand/10 text-brand" : "hover:bg-muted")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">Verification</h3>
            <select 
              value={verStatusFilter} 
              onChange={e => setVerStatusFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
            >
              <option value="All">All Status</option>
              <option value="unverified">Unverified</option>
              <option value="needs_review">Needs Review</option>
              <option value="verified">Verified</option>
              <option value="false_positive_likely">FP Likely</option>
            </select>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-3">Language</h3>
            <select 
              value={langFilter} 
              onChange={e => setLangFilter(e.target.value)}
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand"
            >
              <option value="All">All Languages</option>
              <option value="python">Python</option>
              <option value="typescript">TypeScript</option>
              <option value="javascript">JavaScript</option>
              <option value="java">Java</option>
              <option value="dotnet">.NET</option>
            </select>
          </div>

          <label className="flex items-center gap-2 rounded-lg border border-border bg-card/40 p-3 text-sm font-semibold">
            <input
              type="checkbox"
              checked={hidePreviousFp}
              onChange={(e) => setHidePreviousFp(e.target.checked)}
            />
            Hide previously false positive
          </label>
          
          {/* Collapsed Timeline */}
          {scan.scanEvents && scan.scanEvents.length > 0 && (
            <div className="mt-auto border-t border-border pt-4">
               <details className="group">
                 <summary className="text-xs font-bold uppercase text-muted-foreground cursor-pointer hover:text-foreground">
                   Show Scan Timeline ▾
                 </summary>
                 <div className="mt-3">
                    <ScanTimeline events={scan.scanEvents} />
                 </div>
               </details>
            </div>
          )}
        </div>

        {/* CENTER COLUMN: List */}
        <div className="flex-1 flex flex-col min-w-0 bg-background relative border-r border-border">
          {findings.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-8 text-center flex-col">
              {scan.status === "completed" ? (
                <>
                  <ShieldCheck className="w-16 h-16 text-emerald-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
                  <h3 className="text-xl font-bold text-foreground">No Vulnerabilities Found!</h3>
                  <p className="text-muted-foreground mt-2">Your code looks clean. Great job!</p>
                </>
              ) : scan.status === "failed" ? (
                <>
                  <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
                  <h3 className="text-xl font-bold text-foreground">Scan Failed</h3>
                  <p className="text-muted-foreground mt-2">The scan encountered an error. Please try again.</p>
                </>
              ) : (
                <>
                  <Activity className="w-16 h-16 text-brand mx-auto mb-4 animate-pulse drop-shadow-[0_0_15px_rgba(0,201,232,0.5)]" />
                  <h3 className="text-xl font-bold text-foreground">Scan In Progress...</h3>
                  <p className="text-muted-foreground mt-2">Results will appear here when the scan completes.</p>
                  <a href={`/scan/${scan.id}`}
                    className="mt-6 inline-block bg-gradient-to-b from-[#21dcf8] to-[#0797b9] hover:opacity-90 text-foreground px-6 py-2.5 rounded-xl text-sm font-bold shadow-[0_0_15px_rgba(0,207,234,0.3)] transition-all">
                    Refresh Page
                  </a>
                </>
              )}
            </div>
          ) : filtered.length === 0 ? (
             <div className="flex-1 flex items-center justify-center p-8 text-center flex-col">
               <ShieldCheck className="w-16 h-16 text-muted-foreground/30 mb-4" />
               <h3 className="text-lg font-bold">No findings found</h3>
               <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
             </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {paginated.map(item => {
                const isSelected = selectedId === item.id;
                return (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      "flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all hover:border-brand/50",
                      isSelected ? "bg-muted/80 border-brand/50 shadow-sm" : "bg-card border-border/50 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <SeverityBadge level={item.severity} />
                        <span className="text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded uppercase">CVSS {item.cvss4.toFixed(1)}</span>
                        <VerificationBadge status={item.verificationStatus} />
                        {item.previouslyFalsePositive && (
                          <span className="text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase">Previous FP</span>
                        )}
                      </div>
                    </div>
                    <h4 className="text-sm font-bold leading-snug line-clamp-2 text-foreground">{item.title}</h4>
                    <p className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground truncate bg-black/10 dark:bg-black/30 w-fit px-1.5 py-0.5 rounded border border-border/50 mt-1">
                      <FileCode2 className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate">{item.filePath}</span>:L{item.lineNumber}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="h-14 shrink-0 border-t border-border bg-card flex items-center justify-between px-4">
              <span className="text-xs text-muted-foreground">
                Page <strong className="text-foreground">{currentPage}</strong> of {totalPages}
              </span>
              <div className="flex gap-1">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="p-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: Detail Panel */}
        <div className="w-[420px] xl:w-[480px] shrink-0 bg-card/20 flex flex-col h-full overflow-hidden hidden lg:flex relative">
          {!selectedFinding ? (
            <div className="flex-1 flex items-center justify-center text-center p-8 flex-col text-muted-foreground">
              <Activity className="w-12 h-12 mb-4 opacity-20" />
              <p>Select a finding from the list to view details.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto flex flex-col">
              <div className="p-5 border-b border-border bg-card/40">
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <SeverityBadge level={selectedFinding.severity} />
                  <span className="text-xs font-bold text-slate-500 uppercase">{selectedFinding.ruleId}</span>
                  {selectedFinding.cweId && (
                    <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-0.5 rounded-full border border-brand/20">{selectedFinding.cweId}</span>
                  )}
                  {selectedFinding.owaspCategory && (
                    <span className="text-xs font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full border border-purple-500/20">{selectedFinding.owaspCategory}</span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-foreground mb-3">{selectedFinding.title}</h2>
                <div className="flex flex-col gap-2 p-3 bg-muted/40 rounded-xl border border-border font-mono text-xs overflow-x-auto">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-12 shrink-0">File:</span>
                    <span className="text-foreground break-all">{selectedFinding.filePath}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-12 shrink-0">Line:</span>
                    <span className="text-brand font-bold">
                      {selectedFinding.lineStart || selectedFinding.lineNumber}
                      {selectedFinding.lineEnd && selectedFinding.lineEnd !== (selectedFinding.lineStart || selectedFinding.lineNumber) ? `-${selectedFinding.lineEnd}` : ""}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-12 shrink-0">Conf:</span>
                    <span className="text-foreground">{Math.round((selectedFinding.confidence || 0) * 100)}%</span>
                  </div>
                  {selectedFinding.functionName && (
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-12 shrink-0">Func:</span>
                      <span className="text-emerald-400">{selectedFinding.functionName}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedFinding.codeLink ? (
                    <a
                      href={selectedFinding.codeLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold hover:border-brand hover:text-brand"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      View code
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-muted-foreground">
                      <FileCode2 className="h-3.5 w-3.5" />
                      {selectedFinding.filePath}:L{selectedFinding.lineNumber}
                    </span>
                  )}
                  {selectedFinding.previouslyFalsePositive && (
                    <span className="inline-flex items-center rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-500">
                      Previously marked false positive
                    </span>
                  )}
                </div>
              </div>
              
              {/* Detail Tabs */}
              <div className="flex gap-1 p-2 border-b border-border bg-card/30 overflow-x-auto">
                {['evidence', 'impact', 'fix', 'pentest', 'ai', 'triage', 'references'].map(t => (
                  <button 
                    key={t}
                    onClick={() => setDetailTab(t)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold capitalize rounded-lg transition-colors whitespace-nowrap",
                      detailTab === t ? "bg-brand text-brand-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div className="flex-1 p-5 overflow-y-auto">
                {detailTab === 'evidence' && (
                  <div className="space-y-5">
                    {selectedFinding.evidence && (
                      <div className="rounded-xl border border-amber-200 dark:border-amber-500/20 bg-amber-50 dark:bg-amber-500/10 p-4">
                        <p className="mb-2 text-xs font-bold uppercase text-amber-700 dark:text-amber-400">Evidence</p>
                        <code className="text-xs text-amber-900 dark:text-amber-200 break-words">{selectedFinding.evidence}</code>
                      </div>
                    )}
                    <div className="rounded-xl overflow-hidden border border-border/50">
                      {selectedFinding.codeSnippet ? (
                        <CodeSnippet code={selectedFinding.codeSnippet} language={inferLanguage(selectedFinding.filePath)} />
                      ) : (
                        <div className="p-4 text-sm text-slate-500 bg-slate-100 dark:bg-black/50 text-center">No snippet available</div>
                      )}
                    </div>
                    <div className="space-y-4">
                      <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 p-4">
                        <h4 className="text-xs font-bold uppercase text-brand mb-2">Why vulnerable</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedFinding.whyVulnerable || selectedFinding.attackScenario}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 p-4">
                        <h4 className="text-xs font-bold uppercase text-brand mb-2">Attack scenario</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{selectedFinding.attackScenario || "No attack scenario available."}</p>
                      </div>
                    </div>
                  </div>
                )}
                
                {detailTab === 'impact' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4">
                      <h4 className="mb-2 text-xs font-bold uppercase text-red-700 dark:text-red-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-4 h-4" /> Security Impact
                      </h4>
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{selectedFinding.impact || selectedFinding.attackScenario || "No impact description available."}</p>
                    </div>
                  </div>
                )}
                
                {detailTab === 'fix' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 p-4">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <h4 className="text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                          <ShieldCheck className="w-4 h-4" /> Remediation
                        </h4>
                        <button
                          onClick={() => copyText(selectedFinding.remediation)}
                          className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                        >
                          <Copy className="h-3 w-3" />
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{selectedFinding.remediation}</p>
                    </div>
                    {selectedFinding.secureExample && (
                      <div className="rounded-xl border border-border bg-slate-50 dark:bg-white/5 p-4">
                        <h4 className="mb-2 text-xs font-bold uppercase text-brand">Secure example</h4>
                        <CodeSnippet code={selectedFinding.secureExample} language={inferLanguage(selectedFinding.filePath)} />
                      </div>
                    )}
                  </div>
                )}

                {detailTab === 'pentest' && (
                  <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h4 className="text-xs font-bold uppercase text-brand">Pentest Guidance</h4>
                      <button
                        onClick={() => copyText(buildPentestGuidance(selectedFinding))}
                        className="inline-flex items-center gap-1 rounded-md border border-brand/20 px-2 py-1 text-xs font-semibold text-brand"
                      >
                        <Copy className="h-3 w-3" />
                        Copy
                      </button>
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{buildPentestGuidance(selectedFinding)}</p>
                  </div>
                )}

                {detailTab === 'ai' && (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-slate-50 dark:bg-white/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-foreground">AI Review Finding</h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Reviews masked, truncated evidence and stores the result in the finding timeline.
                          </p>
                        </div>
                        <button
                          onClick={runAiReview}
                          disabled={aiLoading || aiAvailable !== true}
                          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {aiLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                          Review
                        </button>
                      </div>
                      {aiAvailable === false && <p className="mt-3 text-sm text-amber-500">{aiReason || "AI review is disabled."}</p>}
                      {aiError && <p className="mt-3 text-sm text-red-500">{aiError}</p>}
                    </div>
                    {aiReview && (
                      <div className="space-y-3 rounded-xl border border-brand/20 bg-brand/5 p-4 text-sm">
                        <div className="flex flex-wrap gap-2">
                          <span className="rounded-full bg-background px-2 py-1 text-xs font-bold">
                            {aiReview.isLikelyTruePositive ? "Likely true positive" : "Likely false positive"}
                          </span>
                          {typeof aiReview.confidence === "number" && (
                            <span className="rounded-full bg-background px-2 py-1 text-xs font-bold">
                              Confidence {Math.round(aiReview.confidence * 100)}%
                            </span>
                          )}
                        </div>
                        {aiReview.explanation && <p className="text-slate-700 dark:text-slate-200">{aiReview.explanation}</p>}
                        {aiReview.suggestedFix && (
                          <div>
                            <p className="mb-1 text-xs font-bold uppercase text-brand">Suggested fix</p>
                            <p className="text-slate-700 dark:text-slate-200">{aiReview.suggestedFix}</p>
                          </div>
                        )}
                        {aiReview.secureCodeExample && <CodeSnippet code={aiReview.secureCodeExample} language={inferLanguage(selectedFinding.filePath)} />}
                        {aiReview.pentestSuggestion && (
                          <div>
                            <p className="mb-1 text-xs font-bold uppercase text-brand">Pentest suggestion</p>
                            <p className="text-slate-700 dark:text-slate-200">{aiReview.pentestSuggestion}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                
                {detailTab === 'triage' && (
                  <div className="space-y-6">
                     <div className="grid gap-3">
                       <label className="grid gap-1.5">
                         <span className="text-xs font-bold uppercase text-muted-foreground">Status</span>
                         <select
                           value={selectedFinding.status || "open"}
                           onChange={(e) => updateFinding(selectedFinding.id, { status: e.target.value })}
                           className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-brand"
                         >
                           <option value="open">Open</option>
                           <option value="confirmed">Confirmed</option>
                           <option value="in_progress">In Progress</option>
                           <option value="fixed">Fixed</option>
                           <option value="accepted_risk">Accepted Risk</option>
                           <option value="false_positive">False Positive</option>
                           <option value="ignored">Ignored</option>
                           <option value="reopened">Reopened</option>
                         </select>
                       </label>
                       <label className="grid gap-1.5">
                         <span className="text-xs font-bold uppercase text-muted-foreground">Verification</span>
                         <select
                           value={selectedFinding.verificationStatus || "unverified"}
                           onChange={(e) => updateFinding(selectedFinding.id, { verification_status: e.target.value })}
                           className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm focus:outline-none focus:border-brand"
                         >
                           <option value="unverified">Unverified</option>
                           <option value="verified">Verified</option>
                           <option value="needs_review">Needs Review</option>
                           <option value="false_positive_likely">FP Likely</option>
                           <option value="skipped">Skipped</option>
                           <option value="failed">Verify Failed</option>
                         </select>
                       </label>
                       <label className="grid gap-1.5">
                         <span className="text-xs font-bold uppercase text-muted-foreground">Assignee</span>
                         <AssigneeSelect finding={selectedFinding} />
                       </label>
                     </div>
                     <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 p-4">
                       <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-4">Event Timeline</h4>
                       <FindingTimeline findingId={selectedFinding.id} />
                     </div>
                  </div>
                )}

                {detailTab === 'references' && (
                  <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border/50 p-4">
                    <h4 className="text-xs font-bold uppercase text-slate-500 mb-3">External Links</h4>
                    {selectedFinding.references ? (
                      <div className="flex flex-col gap-2">
                        {selectedFinding.references.split(/[\n,]+/).map(r => r.trim()).filter(Boolean).map(link => (
                          <a key={link} href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-brand hover:underline break-all">
                            <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            {link}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No references available.</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
