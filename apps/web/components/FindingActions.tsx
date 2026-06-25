"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, XCircle, Loader2 } from "lucide-react";

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
        <span className="text-zinc-500 font-medium px-2 py-1 bg-zinc-800 rounded">Marked as False Positive</span>
        <button onClick={() => handleUpdateStatus("open")} className="text-blue-400 hover:text-blue-300 underline text-xs">Undo</button>
      </div>
    );
  }

  if (status === "confirmed") {
    return (
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-emerald-500 font-medium px-2 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded">Confirmed Risk</span>
        <button onClick={() => handleUpdateStatus("open")} className="text-blue-400 hover:text-blue-300 underline text-xs">Undo</button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      {isLoading ? (
        <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
      ) : (
        <>
          <button
            onClick={() => handleUpdateStatus("confirmed")}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-colors"
          >
            <Check className="w-4 h-4" />
            <span>Confirm</span>
          </button>
          <button
            onClick={() => handleUpdateStatus("false_positive")}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <XCircle className="w-4 h-4" />
            <span>False Positive</span>
          </button>
        </>
      )}
    </div>
  );
}
