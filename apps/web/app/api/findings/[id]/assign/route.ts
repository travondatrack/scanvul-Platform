import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canManageFinding, isEligibleProjectAssignee } from "@/lib/access";
import { createAuditEvent } from "@/lib/audit";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { createFindingEvent, displayUserName } from "@/lib/finding-events";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { assigneeId } = body; // can be null to unassign

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

    if (!existing.projectId) {
      return NextResponse.json({ error: "Finding is not linked to a project" }, { status: 400 });
    }

    if (assigneeId) {
      const [targetUser, eligible] = await Promise.all([
        prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true, status: true } }),
        isEligibleProjectAssignee(existing.projectId, assigneeId),
      ]);
      if (!targetUser) {
        return NextResponse.json({ error: "Assignee not found" }, { status: 400 });
      }
      if (targetUser.status !== "active" || !eligible) {
        return NextResponse.json({ error: "Assignee is not a member of this project scope" }, { status: 400 });
      }
    }

    const finding = await prisma.$transaction(async (tx) => {
      const updated = await tx.finding.update({
        where: { id: resolvedParams.id },
        data: { assigneeId: assigneeId || null },
      });

      if ((assigneeId || null) !== existing.assigneeId) {
        await createFindingEvent(tx, {
          findingId: existing.id,
          userId: user.id,
          eventType: assigneeId ? "assigned" : "unassigned",
          oldValue: existing.assigneeId,
          newValue: assigneeId || null,
        });

        await createAuditEvent(tx, {
          userId: user.id,
          action: "finding.assign",
          entityType: "Finding",
          entityId: existing.id,
          metadata: {
            projectId: existing.projectId,
            scanId: existing.scanId,
            oldValue: existing.assigneeId,
            newValue: assigneeId || null,
          },
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip"),
        });

        if (assigneeId && assigneeId !== user.id) {
          await tx.notification.create({
            data: {
              userId: assigneeId,
              type: NOTIFICATION_TYPES.findingAssigned,
              title: "Finding assigned to you",
              message: `${displayUserName(user)} assigned ${existing.title} to you.`,
              payload: JSON.stringify({
                findingId: existing.id,
                projectId: existing.projectId,
                scanId: existing.scanId,
                actorId: user.id,
              }),
            },
          });
        }
      }

      return updated;
    });

    return NextResponse.json(finding);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Finding assign error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
