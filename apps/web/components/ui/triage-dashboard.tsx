"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
  ArrowLeft, CheckCircle, AlertTriangle, RefreshCw, 
  ShieldCheck, ShieldAlert, FileCode2, ChevronLeft, ChevronRight,
  HelpCircle, ShieldX, SkipForward, ExternalLink, Activity
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

export function TriageDashboard({ 
  scan, 
  findings, 
  stats 
}: { 
  scan: any; 
  findings: FindingItem[];
  stats: { critical: number; high: number; medium: number; low: number; total: number; riskScore: number };
}) {
  const [activeTab, setActiveTab] = useState("All");
  const [verStatusFilter, setVerStatusFilter] = useState("All");
  const [langFilter, setLangFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<string | null>(findings[0]?.id || null);
  const [detailTab, setDetailTab] = useState("evidence");
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  const isRunning = scan.status === "queued" || scan.status === "running";
  
  const router = useRouter();
  const prevStatus = useRef(scan.status);

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
        return sevOk && verOk && langOk;
      })
      .sort((a, b) => {
        return (severityRank[b.severity] ?? 0) - (severityRank[a.severity] ?? 0) || b.cvss4 - a.cvss4;
      });
  }, [findings, activeTab, verStatusFilter, langFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, verStatusFilter, langFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  
  const selectedFinding = useMemo(() => findings.find(f => f.id === selectedId), [findings, selectedId]);

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
                </div>
                <h2 className="text-lg font-bold text-foreground mb-3">{selectedFinding.title}</h2>
                <div className="flex flex-col gap-2 p-3 bg-muted/40 rounded-xl border border-border font-mono text-xs overflow-x-auto">
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-12 shrink-0">File:</span>
                    <span className="text-foreground break-all">{selectedFinding.filePath}</span>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-slate-500 w-12 shrink-0">Line:</span>
                    <span className="text-brand font-bold">{selectedFinding.lineNumber}</span>
                  </div>
                  {selectedFinding.functionName && (
                    <div className="flex gap-2">
                      <span className="text-slate-500 w-12 shrink-0">Func:</span>
                      <span className="text-emerald-400">{selectedFinding.functionName}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Detail Tabs */}
              <div className="flex gap-1 p-2 border-b border-border bg-card/30 overflow-x-auto">
                {['evidence', 'impact', 'fix', 'triage', 'references'].map(t => (
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
                      <h4 className="mb-2 text-xs font-bold uppercase text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                        <ShieldCheck className="w-4 h-4" /> Remediation
                      </h4>
                      <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{selectedFinding.remediation}</p>
                    </div>
                    {selectedFinding.pentestHint && (
                      <div className="rounded-xl border border-brand/20 bg-brand/5 p-4 mt-4">
                        <h4 className="mb-2 text-xs font-bold uppercase text-brand">Pentest Hints</h4>
                        <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed">{selectedFinding.pentestHint}</p>
                      </div>
                    )}
                  </div>
                )}
                
                {detailTab === 'triage' && (
                  <div className="space-y-6">
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
