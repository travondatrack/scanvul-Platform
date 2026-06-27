"use client";

import { useState, useEffect } from "react";
import { formatVietnamDate } from "@/lib/date-format";

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const diffMs = Date.now() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  
  if (diffSecs < 60) return "just now";
  
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;
  
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs} hour${diffHrs > 1 ? "s" : ""} ago`;
  
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  
  return formatVietnamDate(date);
}

export function FindingTimeline({ findingId }: { findingId: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/findings/${findingId}/events`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [findingId]);

  const handleComment = async () => {
    if (!comment.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/findings/${findingId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (res.ok) {
        setComment("");
        fetchEvents();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="text-sm text-slate-500 p-4">Loading timeline...</div>;

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {events.length === 0 ? (
          <p className="text-sm text-slate-500">No events yet.</p>
        ) : (
          events.map((ev) => (
            <div key={ev.id} className="flex gap-3 text-sm">
              <div className="mt-1 h-2 w-2 rounded-full bg-slate-300 shrink-0" />
              <div>
                <p className="text-slate-900 dark:text-slate-100">
                  <span className="font-semibold">{ev.user?.name || "System"}</span>
                  {ev.eventType === "status_changed" && ` changed status from ${ev.oldValue || "open"} to ${ev.newValue}`}
                  {ev.eventType === "verification_status_changed" && ` changed verification to ${ev.newValue}`}
                  {ev.eventType === "comment" && " left a comment"}
                  {ev.eventType === "assigned" && " assigned this finding"}
                </p>
                {ev.comment && (
                  <div className="mt-1 rounded bg-slate-100 dark:bg-zinc-800 p-2 text-slate-700 dark:text-zinc-300 whitespace-pre-wrap">
                    {ev.comment}
                  </div>
                )}
                <p className="mt-1 text-xs text-slate-500">
                  {formatRelativeTime(ev.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-col gap-2 pt-2 border-t border-slate-100 dark:border-zinc-800">
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment..."
          className="w-full rounded-md border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-sm text-slate-900 dark:text-slate-100"
          rows={3}
        />
        <button
          onClick={handleComment}
          disabled={submitting || !comment.trim()}
          className="self-end rounded bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          {submitting ? "Posting..." : "Post Comment"}
        </button>
      </div>
    </div>
  );
}
