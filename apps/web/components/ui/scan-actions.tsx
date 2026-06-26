"use client";

import { useState } from "react";
import { Download, Share2, Trash2, Check, Copy } from "lucide-react";

interface ScanActionsProps {
  scanId: string;
  initialBadgeUrl?: string | null;
}

export function ScanActions({ scanId, initialBadgeUrl }: ScanActionsProps) {
  const [badgeUrl, setBadgeUrl] = useState<string | null>(initialBadgeUrl || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleExport = (format: string) => {
    window.location.href = `/api/reports/${scanId}?format=${format}`;
  };

  const generateBadge = async () => {
    try {
      setIsGenerating(true);
      const res = await fetch(`/api/scans/${scanId}/badge`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setBadgeUrl(`${window.location.origin}${data.badgeUrl}`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const revokeBadge = async () => {
    try {
      const res = await fetch(`/api/scans/${scanId}/badge`, { method: "DELETE" });
      if (res.ok) setBadgeUrl(null);
    } catch (e) {
      console.error(e);
    }
  };

  const copyToClipboard = () => {
    if (badgeUrl) {
      navigator.clipboard.writeText(badgeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <div className="flex bg-[#0b1215]/80 border border-white/10 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(0,0,0,0.1)]">
        <button onClick={() => handleExport('json')} className="px-3 py-2 text-sm font-bold text-white hover:bg-white/10 transition-colors border-r border-white/10 flex items-center gap-2">
          <Download className="w-4 h-4" /> JSON
        </button>
        <button onClick={() => handleExport('sarif')} className="px-3 py-2 text-sm font-bold text-white hover:bg-white/10 transition-colors border-r border-white/10">
          SARIF
        </button>
        <button onClick={() => handleExport('pdf')} className="px-3 py-2 text-sm font-bold text-white hover:bg-white/10 transition-colors">
          PDF
        </button>
      </div>

      {!badgeUrl ? (
        <button onClick={generateBadge} disabled={isGenerating} className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 shadow-[0_0_15px_rgba(99,102,241,0.3)] hover:scale-105 transition-transform disabled:opacity-50">
          <Share2 className="w-4 h-4" /> {isGenerating ? "Generating..." : "Publish Badge"}
        </button>
      ) : (
        <div className="flex items-center bg-[#0b1215]/80 border border-purple-500/30 rounded-xl overflow-hidden shadow-[0_0_15px_rgba(168,85,247,0.15)]">
          <div className="px-3 py-2 text-xs text-slate-300 border-r border-white/10 max-w-[150px] truncate">
            {badgeUrl}
          </div>
          <button onClick={copyToClipboard} className="px-3 py-2 hover:bg-white/10 transition-colors text-slate-300 border-r border-white/10">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={revokeBadge} className="px-3 py-2 hover:bg-red-500/20 hover:text-red-400 transition-colors text-slate-300" title="Revoke Badge">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
