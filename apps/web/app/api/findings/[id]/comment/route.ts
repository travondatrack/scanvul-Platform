import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canManageFinding } from "@/lib/access";
import { createAuditEvent } from "@/lib/audit";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { displayUserName } from "@/lib/finding-events";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { comment } = body;

    if (typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json({ error: "Comment is required" }, { status: 400 });
    }

    const resolvedParams = await Promise.resolve(params);
    const existing = await prisma.finding.findUnique({
      where: { id: resolvedParams.id },
      select: {
        id: true,
        title: true,
        assigneeId: true,
        projectId: true,
        scanId: true,
      },
    });

    if (!existing || !(await canManageFinding(user.id, resolvedParams.id))) {
      return NextResponse.json({ error: "Finding not found or unauthorized" }, { status: 404 });
    }

    const trimmed = comment.trim().slice(0, 5000);
    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.findingEvent.create({
        data: {
          findingId: existing.id,
          userId: user.id,
          eventType: "comment",
          comment: trimmed,
        },
        include: { user: { select: { id: true, name: true, email: true, image: true } } },
      });

      await createAuditEvent(tx, {
        userId: user.id,
        action: "finding.comment",
        entityType: "Finding",
        entityId: existing.id,
        metadata: { findingId: existing.id, projectId: existing.projectId, scanId: existing.scanId },
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip"),
      });

      if (existing.assigneeId && existing.assigneeId !== user.id) {
        await tx.notification.create({
          data: {
            userId: existing.assigneeId,
            type: NOTIFICATION_TYPES.findingCommented,
            title: "New finding comment",
            message: `${displayUserName(user)} commented on ${existing.title}.`,
            payload: JSON.stringify({
              findingId: existing.id,
              projectId: existing.projectId,
              scanId: existing.scanId,
              actorId: user.id,
            }),
          },
        });
      }

      return created;
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Finding comment error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
