"use client";

import { Check, Copy, Loader2, Share2 } from "lucide-react";
import { useState } from "react";

import { publishBadge } from "@/lib/api";

import { Button } from "./button";

export function BadgePublisher({ scanId }: { scanId: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function onPublish() {
    setLoading(true);
    setError("");
    try {
      const result = await publishBadge(scanId);
      const publicUrl = `${window.location.origin}${result.publicUrl}`;
      setUrl(publicUrl);
      await navigator.clipboard.writeText(publicUrl);
    } catch (publishError) {
      setError(
        publishError instanceof Error ? publishError.message : "Failed to publish badge",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        onClick={onPublish}
        className="h-10 rounded-lg bg-emerald-600 hover:bg-emerald-700"
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : url ? (
          <Check className="mr-2 h-4 w-4" />
        ) : (
          <Share2 className="mr-2 h-4 w-4" />
        )}
        {loading ? "Publishing" : url ? "Copied" : "Publish"}
      </Button>
      {url ? (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(url)}
          className="inline-flex max-w-64 items-center gap-2 truncate rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600"
        >
          <Copy className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{url}</span>
        </button>
      ) : null}
      {error ? (
        <span className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </span>
      ) : null}
    </div>
  );
}
