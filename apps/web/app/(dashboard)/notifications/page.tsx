"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, Loader2, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { formatVietnamDateTime } from "@/lib/date-format";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  message: string;
  status: string;
  payload: Record<string, unknown>;
  createdAt: string;
  actedAt?: string | null;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "scan" | "finding" | "team">("all");

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (filter === "unread") params.set("unread", "true");
      if (filter === "scan" || filter === "finding" || filter === "team") params.set("category", filter);
      const res = await fetch(`/api/notifications${params.toString() ? `?${params.toString()}` : ""}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load notifications");
      }
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  async function actionInvite(notificationId: string, action: "accept" | "reject") {
    setActingId(notificationId);
    setError("");
    try {
      const res = await fetch(`/api/notifications/${notificationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Could not update invitation");
      }
      await fetchNotifications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update invitation");
    } finally {
      setActingId(null);
    }
  }

  async function markRead(notificationId: string) {
    await fetch(`/api/notifications/${notificationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "read" }),
    });
    setItems((current) => current.map((item) => (
      item.id === notificationId ? { ...item, status: "read" } : item
    )));
  }

  async function markAllRead() {
    const res = await fetch("/api/notifications", { method: "POST" });
    if (res.ok) {
      setItems((current) => current.map((item) => ({ ...item, status: "read" })));
    }
  }

  function notificationHref(item: NotificationItem) {
    const payload = item.payload || {};
    const scanId = typeof payload.scanId === "string" ? payload.scanId : "";
    const findingId = typeof payload.findingId === "string" ? payload.findingId : "";
    const projectId = typeof payload.projectId === "string" ? payload.projectId : "";
    if (findingId && scanId) return `/scan/${scanId}`;
    if (scanId) return `/scan/${scanId}`;
    if (projectId) return `/projects/${projectId}`;
    if (item.type.includes("invite") || item.type.includes("team") || item.type.includes("member")) return "/team";
    return "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Review team invitations and activity updates."
      />

      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {(["all", "unread", "scan", "finding", "team"] as const).map((value) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              onClick={() => setFilter(value)}
            >
              {value}
            </Button>
          ))}
        </div>
        <Button size="sm" variant="outline" onClick={markAllRead}>
          Mark all as read
        </Button>
      </Card>

      {error && (
        <Card className="border-destructive/20 bg-destructive/5 p-4 text-sm font-medium text-destructive">
          {error}
        </Card>
      )}

      {loading ? (
        <Card className="p-8 text-center text-muted-foreground">
          <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />
          Loading notifications...
        </Card>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center">
          <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground">No notifications</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Team invites and membership updates will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const isInvite = item.type === "team_invite" && !item.actedAt && item.status !== "actioned";
            const isUnread = item.status === "unread";
            const href = notificationHref(item);
            return (
              <Card key={item.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-foreground">{item.title}</h2>
                      {isUnread && <Badge>New</Badge>}
                      {item.status === "actioned" && <Badge variant="muted">Handled</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{item.message}</p>
                    <p className="text-xs text-muted-foreground">{formatVietnamDateTime(item.createdAt)}</p>
                  </div>

                  <div className="flex shrink-0 flex-wrap gap-2">
                    {href && (
                      <Button size="sm" variant="outline" asChild>
                        <Link href={href}>
                          <ExternalLink className="h-4 w-4" />
                          Open
                        </Link>
                      </Button>
                    )}
                    {isInvite ? (
                      <>
                        <Button
                          size="sm"
                          onClick={() => actionInvite(item.id, "accept")}
                          disabled={actingId === item.id}
                        >
                          {actingId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => actionInvite(item.id, "reject")}
                          disabled={actingId === item.id}
                        >
                          <X className="h-4 w-4" />
                          Reject
                        </Button>
                      </>
                    ) : isUnread ? (
                      <Button size="sm" variant="outline" onClick={() => markRead(item.id)}>
                        Mark read
                      </Button>
                    ) : null}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
