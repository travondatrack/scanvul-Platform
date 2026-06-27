import { NextRequest, NextResponse } from "next/server";

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

    if (action !== "accept" && action !== "decline") {
      return NextResponse.json({ error: "Invalid notification action" }, { status: 400 });
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });

    if (!notification) {
      return NextResponse.json({ error: "Notification not found" }, { status: 404 });
    }

    if (notification.type !== "team_invite") {
      return NextResponse.json({ error: "Notification cannot be actioned" }, { status: 400 });
    }

    if (notification.actedAt || notification.status === "actioned") {
      return NextResponse.json({ error: "Invitation already handled" }, { status: 400 });
    }

    const payload = parseNotificationPayload(notification.payload);
    const organizationId = stringPayloadValue(payload, "organizationId");
    const organizationName = stringPayloadValue(payload, "organizationName");
    const role = stringPayloadValue(payload, "role") || "member";
    const invitedBy = stringPayloadValue(payload, "invitedBy");

    if (!organizationId || !invitedBy) {
      return NextResponse.json({ error: "Invitation is no longer valid" }, { status: 400 });
    }

    const now = new Date();
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

      if (action === "accept") {
        await tx.organizationMember.upsert({
          where: {
            organizationId_userId: {
              organizationId,
              userId: user.id,
            },
          },
          update: { role },
          create: { organizationId, userId: user.id, role },
        });
      }

      const updated = await tx.notification.update({
        where: { id },
        data: { status: "actioned", readAt: now, actedAt: now },
      });

      await tx.notification.create({
        data: {
          userId: invitedBy,
          type: action === "accept" ? "team_invite_accepted" : "team_invite_declined",
          title: action === "accept" ? "Team invite accepted" : "Team invite declined",
          message: `${user.name || user.email || "A user"} ${action === "accept" ? "accepted" : "declined"} your invitation to ${organization.name || organizationName}.`,
          payload: JSON.stringify({
            organizationId,
            organizationName: organization.name || organizationName,
            userId: user.id,
            action,
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
