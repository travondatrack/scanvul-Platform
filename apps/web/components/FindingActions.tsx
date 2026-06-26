"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function FindingActions({ findingId, initialStatus }: { findingId: string, initialStatus: string }) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [isLoading, setIsLoading] = useState(false);

  const handleUpdateStatus = async (newStatus: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/findings/${findingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!res.ok) throw new Error("Failed to update status");
      
      setStatus(newStatus);
      router.refresh();
    } catch (error) {
      console.error(error);
      alert("Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "false_positive") {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <Badge variant="muted">Marked as False Positive</Badge>
        <Button variant="link" size="sm" onClick={() => handleUpdateStatus("open")}>Undo</Button>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <Badge variant="success">Confirmed Risk</Badge>
        <Button variant="link" size="sm" onClick={() => handleUpdateStatus("open")}>Undo</Button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      ) : (
        <>
          <Button
            variant="success"
            size="sm"
            onClick={() => handleUpdateStatus("confirmed")}
          >
            <Check className="w-4 h-4" />
            <span>Confirm</span>
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleUpdateStatus("false_positive")}
          >
            <XCircle className="w-4 h-4" />
            <span>False Positive</span>
          </Button>
        </>
      )}
    </div>
  );
}
