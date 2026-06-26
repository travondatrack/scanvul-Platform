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
    if (type.includes("started") || type.includes("running")) return <PlayCircle className="w-4 h-4 text-brand" />;
    if (type.includes("failed") || type.includes("error")) return <AlertCircle className="w-4 h-4 text-red-400" />;
    if (type.includes("completed")) return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    return <Clock className="w-4 h-4 text-slate-400" />;
  };

  return (
    <div className="bg-card text-card-foreground border border-border rounded-xl p-6 shadow-sm">
      <h3 className="text-lg font-bold text-foreground mb-6">Scan Timeline</h3>
      <div className="relative border-l border-border ml-3 space-y-6">
        {sortedEvents.map((event, idx) => (
          <div key={event.id} className="relative pl-6">
            <span className="absolute -left-2.5 top-1 bg-card border border-border rounded-full p-0.5">
              {getIcon(event.eventType)}
            </span>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-foreground capitalize">{event.eventType.replace(/_/g, " ")}</span>
              <span className="text-xs text-slate-400 mt-1">{new Date(event.createdAt).toLocaleString()}</span>
              {event.message && (
                <p className="text-sm text-foreground mt-2 bg-muted/40 p-3 rounded-xl border border-border">
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
