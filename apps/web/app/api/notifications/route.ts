import { NextRequest, NextResponse } from "next/server";

import { parseNotificationPayload } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));

    const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";
    const category = req.nextUrl.searchParams.get("category");
    const typeFilter =
      category === "scan" ? ["scan_completed", "scan_failed"] :
      category === "finding" ? ["finding_assigned", "finding_commented"] :
      category === "team" ? ["team_invite", "invite_accepted", "invite_rejected", "member_left", "member_removed", "team_deleted"] :
      null;

    const where = {
      userId: user.id,
      ...(unreadOnly ? { status: "unread" } : {}),
      ...(typeFilter ? { type: { in: typeFilter } } : {}),
    };

    const [total, notifications] = await Promise.all([
      prisma.notification.count({ where }),
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      items: notifications.map((notification) => ({
        ...notification,
        payload: parseNotificationPayload(notification.payload),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Notification list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await requireActiveUser();
    const result = await prisma.notification.updateMany({
      where: { userId: user.id, status: "unread" },
      data: { status: "read" },
    });
    return NextResponse.json({ updated: result.count });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Notification mark-all error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
