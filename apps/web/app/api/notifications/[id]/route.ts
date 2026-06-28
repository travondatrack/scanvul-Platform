import { NextRequest, NextResponse } from "next/server";

import { NOTIFICATION_TYPES } from "@/lib/constants";
import { parseNotificationPayload } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

function stringPayloadValue(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : "";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const markUnread = body.status === "unread";

    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: markUnread
        ? { status: "unread", readAt: null }
        : { status: "read", readAt: new Date() },
    });

    return NextResponse.json({
      ...updated,
      payload: parseNotificationPayload(updated.payload),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Notification update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = typeof body.action === "string" ? body.action : "";

    if (action !== "accept" && action !== "decline" && action !== "reject") {
      return NextResponse.json({ error: "Invalid notification action" }, { status: 400 });
    }
    const normalizedAction = action === "decline" ? "reject" : action;

    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    if (notification.type !== NOTIFICATION_TYPES.teamInvite) {
      return NextResponse.json({ error: "Notification cannot be actioned" }, { status: 400 });
    }

    if (notification.actedAt || notification.status === "actioned") {
      return NextResponse.json({ error: "Invitation already handled" }, { status: 400 });
    }

    const payload = parseNotificationPayload(notification.payload);
    const inviteId = stringPayloadValue(payload, "inviteId");
    const organizationId = stringPayloadValue(payload, "organizationId");
    const organizationName = stringPayloadValue(payload, "organizationName");
    const role = stringPayloadValue(payload, "role") || "member";
    const invitedBy = stringPayloadValue(payload, "invitedBy");

    if (!organizationId || !invitedBy || !inviteId) {
      return NextResponse.json({ error: "Invitation is no longer valid" }, { status: 400 });
    }

    const now = new Date();
    if (!user.email) {
      return NextResponse.json({ error: "Invitation requires an email address" }, { status: 400 });
    }
    const userEmail = user.email;
    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true },
      });

      if (!organization) {
        await tx.notification.update({
          where: { id },
          data: { status: "actioned", readAt: now, actedAt: now },
        });
        return { ok: false, error: "Team no longer exists", status: 404 };
      }

      const invite = await tx.organizationInvite.findFirst({
        where: { id: inviteId, organizationId, email: userEmail },
      });

      if (!invite || invite.status !== "pending" || invite.expiresAt < now) {
        await tx.notification.update({
          where: { id },
          data: { status: "actioned", readAt: now, actedAt: now },
        });
        if (invite?.status === "pending") {
          await tx.organizationInvite.update({ where: { id: invite.id }, data: { status: "expired" } });
        }
        return { ok: false, error: "Invitation is no longer valid", status: 400 };
      }

      if (normalizedAction === "accept") {
        await tx.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId,
              userId: user.id,
            },
          },
          update: { role: invite.role || role },
          create: { organizationId, userId: user.id, role: invite.role || role },
        });
      }

      await tx.organizationInvite.update({
        where: { id: invite.id },
        data: {
          status: normalizedAction === "accept" ? "accepted" : "rejected",
          acceptedAt: normalizedAction === "accept" ? now : null,
        },
      });

      const updated = await tx.notification.update({
        where: { id },
        data: { status: "actioned", readAt: now, actedAt: now },
      });

      await tx.notification.create({
        data: {
          userId: invitedBy,
          type: normalizedAction === "accept" ? NOTIFICATION_TYPES.teamInviteAccepted : NOTIFICATION_TYPES.teamInviteRejected,
          title: normalizedAction === "accept" ? "Team invite accepted" : "Team invite rejected",
          message: `${user.name || user.email || "A user"} ${normalizedAction === "accept" ? "accepted" : "rejected"} your invitation to ${organization.name || organizationName}.`,
          payload: JSON.stringify({
            organizationId,
            organizationName: organization.name || organizationName,
            userId: user.id,
            action: normalizedAction,
          }),
        },
      });

      return { ok: true, notification: updated, status: 200 };
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    if (!result.notification) {
      return NextResponse.json({ error: "Invitation could not be updated" }, { status: 500 });
    }

    return NextResponse.json({
      ...result.notification,
      payload: parseNotificationPayload(result.notification.payload),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Notification action error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
