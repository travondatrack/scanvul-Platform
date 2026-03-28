"use client";

import { useState } from "react";

import { publishBadge } from "@/lib/api";

import { Button } from "./button";

export function BadgePublisher({ scanId }: { scanId: string }) {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function onPublish() {
    setLoading(true);
    try {
      const result = await publishBadge(scanId);
      const publicUrl = `${window.location.origin}${result.publicUrl}`;
      setUrl(publicUrl);
      await navigator.clipboard.writeText(publicUrl);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        onClick={onPublish}
        className="bg-emerald-600 hover:bg-emerald-700"
        disabled={loading}
      >
        {loading ? "Publishing..." : "Publish Badge"}
      </Button>
      {url ? (
        <span className="text-xs text-slate-600">Copied: {url}</span>
      ) : null}
    </div>
  );
}
