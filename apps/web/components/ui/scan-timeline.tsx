"use client";

import { CheckCircle2, Clock, PlayCircle, AlertCircle } from "lucide-react";

interface ScanEvent {
  id: string;
  eventType: string;
  message: string | null;
  createdAt: Date;
}

interface ScanTimelineProps {
  events: ScanEvent[];
}

export function ScanTimeline({ events }: ScanTimelineProps) {
  if (!events || events.length === 0) return null;

  const sortedEvents = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const getIcon = (type: string) => {
    if (type.includes("started") || type.includes("running")) return <PlayCircle className="w-4 h-4 text-[#00c9e8]" />;
    if (type.includes("failed") || type.includes("error")) return <AlertCircle className="w-4 h-4 text-red-400" />;
    if (type.includes("completed")) return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="bg-[#0b1215]/80 border border-white/10 rounded-2xl p-6 shadow-[0_14px_42px_rgba(0,0,0,0.16)] backdrop-blur-xl">
      <h3 className="text-lg font-bold text-white mb-6">Scan Timeline</h3>
      <div className="relative border-l border-white/10 ml-3 space-y-6">
        {sortedEvents.map((event, idx) => (
          <div key={event.id} className="relative pl-6">
            <span className="absolute -left-2.5 top-1 bg-[#0b1215] border border-white/10 rounded-full p-0.5">
              {getIcon(event.eventType)}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-white capitalize">{event.eventType.replace(/_/g, " ")}</span>
              <span className="text-xs text-slate-400 mt-1">{new Date(event.createdAt).toLocaleString()}</span>
              {event.message && (
                <p className="text-sm text-slate-300 mt-2 bg-white/5 p-3 rounded-xl border border-white/5">
                  {event.message}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
