"use client";

import { useState } from "react";
import { Download, Share2, Trash2, Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="flex overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <button onClick={() => handleExport('json')} className="px-3 py-2 text-sm font-bold text-foreground hover:bg-muted transition-colors border-r border-border flex items-center gap-2">
          <Download className="w-4 h-4" /> JSON
        </button>
        <button onClick={() => handleExport('sarif')} className="px-3 py-2 text-sm font-bold text-foreground hover:bg-muted transition-colors border-r border-border">
          SARIF
        </button>
        <button onClick={() => handleExport('pdf')} className="px-3 py-2 text-sm font-bold text-foreground hover:bg-muted transition-colors">
          PDF
        </button>
      </div>

      {!badgeUrl ? (
        <Button onClick={generateBadge} disabled={isGenerating} variant="secondary">
          <Share2 className="w-4 h-4" /> {isGenerating ? "Generating..." : "Publish Badge"}
        </Button>
      ) : (
        <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden shadow-sm">
          <div className="px-3 py-2 text-xs text-muted-foreground border-r border-border max-w-[150px] truncate">
            {badgeUrl}
          </div>
          <button onClick={copyToClipboard} className="px-3 py-2 hover:bg-muted transition-colors text-muted-foreground border-r border-border">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={revokeBadge} className="px-3 py-2 hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground" title="Revoke Badge">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
