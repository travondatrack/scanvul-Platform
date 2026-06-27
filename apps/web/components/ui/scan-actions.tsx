"use client";

import { useState } from "react";
import { Download, Share2, Trash2, Check, Copy, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ScanActionsProps {
  scanId: string;
  initialBadgeUrl?: string | null;
}

export function ScanActions({ scanId, initialBadgeUrl }: ScanActionsProps) {
  const [badgeUrl, setBadgeUrl] = useState<string | null>(initialBadgeUrl || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  const handleExport = (format: string) => {
    window.location.href = `/api/reports/${scanId}?format=${format}`;
    setShowExportMenu(false);
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
      {/* Export Dropdown */}
      <div className="relative">
        <Button 
          variant="outline" 
          className="flex items-center gap-2 bg-card border-border"
          onClick={() => setShowExportMenu(!showExportMenu)}
        >
          <Download className="w-4 h-4" /> Export <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </Button>
        
        {showExportMenu && (
          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden">
            <button 
              onClick={() => handleExport('json')} 
              className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors border-b border-border"
            >
              JSON Format
            </button>
            <button 
              onClick={() => handleExport('sarif')} 
              className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors border-b border-border"
            >
              SARIF Format
            </button>
            <button 
              onClick={() => handleExport('pdf')} 
              className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-muted transition-colors text-brand"
            >
              PDF Report
            </button>
          </div>
        )}
      </div>

      {/* Publish Badge */}
      {!badgeUrl ? (
        <Button onClick={generateBadge} disabled={isGenerating} className="bg-brand text-brand-foreground hover:bg-brand/90 font-bold">
          <Share2 className="w-4 h-4 mr-2" /> {isGenerating ? "Generating..." : "Publish"}
        </Button>
      ) : (
        <div className="flex items-center bg-card border border-border rounded-lg overflow-hidden shadow-sm h-10">
          <div className="px-3 py-2 text-xs text-muted-foreground border-r border-border max-w-[150px] truncate">
            {badgeUrl}
          </div>
          <button onClick={copyToClipboard} className="px-3 py-2 hover:bg-muted transition-colors text-muted-foreground border-r border-border h-full flex items-center justify-center w-10">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
          <button onClick={revokeBadge} className="px-3 py-2 hover:bg-destructive/10 hover:text-destructive transition-colors text-muted-foreground h-full flex items-center justify-center w-10" title="Revoke Badge">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
