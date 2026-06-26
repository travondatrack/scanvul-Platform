"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <Button
      onClick={handleTriggerScan}
      disabled={isScanning || !repoUrl}
    >
      {isScanning ? (
        <Loader2 className="w-5 h-5 animate-spin" />
      ) : (
        <Play className="w-5 h-5" />
      )}
      <span>{isScanning ? "Starting..." : "Trigger Scan"}</span>
    </Button>
  );
}
