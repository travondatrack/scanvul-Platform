import { NextRequest, NextResponse } from "next/server";

import { parseNotificationPayload } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const unreadOnly = req.nextUrl.searchParams.get("unread") === "true";

    const notifications = await prisma.notification.findMany({
      where: {
        userId: user.id,
        ...(unreadOnly ? { status: "unread" } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      items: notifications.map((notification) => ({
        ...notification,
        payload: parseNotificationPayload(notification.payload),
      })),
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
