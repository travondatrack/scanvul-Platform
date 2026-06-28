"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TriggerScanButton({ projectId, repoUrl }: { projectId: string; repoUrl: string }) {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);
  const [archive, setArchive] = useState<File | null>(null);

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      let sourceType = "repo_url";
      let sourceValue = repoUrl;

      if (archive) {
        const initRes = await fetch("/api/v1/uploads/init", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: archive.name, size: archive.size }),
        });
        const initData = await initRes.json();
        if (!initRes.ok) throw new Error(initData.detail || initData.error || "Failed to initialize upload");

        const formData = new FormData();
        formData.append("archive", archive);
        const uploadRes = await fetch(`/api/v1/uploads/${initData.uploadId}/data`, {
          method: "PUT",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Failed to upload archive");

        const completeRes = await fetch("/api/v1/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uploadId: initData.uploadId }),
        });
        if (!completeRes.ok) throw new Error("Failed to complete upload");
        sourceType = "archive";
        sourceValue = initData.uploadId;
      }

      const res = await fetch("/api/scans/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, repoUrl, sourceType, sourceValue }),
      });

      if (!res.ok) throw new Error("Failed to trigger scan");
      
      router.refresh(); // Refresh the page to show new scan
    } catch (error) {
      console.error(error);
      alert("Failed to trigger scan");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground hover:bg-muted">
        <Upload className="h-4 w-4" />
        <span className="max-w-[140px] truncate">{archive ? archive.name : "Archive"}</span>
        <input
          type="file"
          accept=".zip,.tar.gz,.tgz"
          className="sr-only"
          onChange={(e) => setArchive(e.target.files?.[0] ?? null)}
        />
      </label>
      <Button
        onClick={handleTriggerScan}
        disabled={isScanning || (!repoUrl && !archive)}
      >
        {isScanning ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Play className="w-5 h-5" />
        )}
        <span>{isScanning ? "Starting..." : archive ? "Scan Archive" : "Trigger Scan"}</span>
      </Button>
    </div>
  );
}
