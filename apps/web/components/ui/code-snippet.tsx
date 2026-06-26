"use client";

import { cn } from "@/lib/utils";
import { Copy, CheckCircle2, Lock } from "lucide-react";
import { useState } from "react";

interface CodeSnippetProps {
  code: string;
  language?: string;
  className?: string;
  isSecret?: boolean; // Determines if masking should apply
}

export function CodeSnippet({ code, language = "plaintext", className, isSecret = false }: CodeSnippetProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Very basic regex-based secret masking (for UX purposes, masks long alphanumeric strings that look like tokens)
  const displayCode = isSecret
    ? code.replace(/(?<=['"=:\s])([A-Za-z0-9_-]{16,})(?=['"\s\n]|$)/g, (match) => {
        return `${match.slice(0, 4)}••••••••••••••••${match.slice(-4)}`;
      })
    : code;

  return (
    <div className={cn("relative group rounded-lg overflow-hidden border border-slate-200 dark:border-zinc-800/50 bg-slate-950 dark:bg-[#0d1117]", className)}>
      <div className="absolute right-2 top-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {isSecret && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/10 text-amber-500 text-xs font-medium border border-amber-500/20 backdrop-blur-sm">
            <Lock className="w-3 h-3" />
            Secrets Masked
          </div>
        )}
        <button
          onClick={handleCopy}
          className="p-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm rounded text-slate-300 transition-colors"
          title="Copy to clipboard"
        >
          {copied ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="px-4 py-2 bg-slate-900 dark:bg-black/40 border-b border-slate-800 flex items-center text-xs text-slate-400 font-mono">
        {language}
      </div>
      <pre className="p-4 overflow-x-auto text-sm text-slate-300 font-mono leading-relaxed">
        <code>{displayCode || "No code provided"}</code>
      </pre>
    </div>
  );
}
