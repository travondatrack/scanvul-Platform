"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";

export default function TriggerScanButton({ projectId, repoUrl }: { projectId: string; repoUrl: string }) {
  const router = useRouter();
  const [isScanning, setIsScanning] = useState(false);

  const handleTriggerScan = async () => {
    setIsScanning(true);
    try {
      const res = await fetch("/api/scans/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, repoUrl }),
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
    <button
      onClick={handleTriggerScan}
      disabled={isScanning || !repoUrl}
      className="flex items-center space-x-2 bg-brand hover:opacity-90 disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-500 text-white px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm dark:shadow-lg dark:shadow-brand/20 active:scale-[0.98]"
    >
      {isScanning ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Play className="w-5 h-5" />
      )}
      <span>{isScanning ? "Starting..." : "Trigger Scan"}</span>
    </button>
  );
}
