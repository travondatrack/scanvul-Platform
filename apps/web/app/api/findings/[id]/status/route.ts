import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canManageFinding } from "@/lib/access";
import { createAuditEvent } from "@/lib/audit";
import { FINDING_STATUSES, VERIFICATION_STATUSES, isOneOf } from "@/lib/constants";
import { createFindingEvent } from "@/lib/finding-events";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { status, verification_status, comment } = body;

    if (status && !isOneOf(FINDING_STATUSES, status)) {
      return NextResponse.json({ error: "Invalid finding status" }, { status: 400 });
    }
    
    if (verification_status && !isOneOf(VERIFICATION_STATUSES, verification_status)) {
      return NextResponse.json({ error: "Invalid verification status" }, { status: 400 });
    }

    if (!status && !verification_status) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const resolvedParams = await Promise.resolve(params);
    const existing = await prisma.finding.findFirst({
      where: { id: resolvedParams.id },
      select: { id: true, status: true, verificationStatus: true, projectId: true, scanId: true },
    });

    if (!existing || !(await canManageFinding(user.id, resolvedParams.id))) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    const finding = await prisma.$transaction(async (tx) => {
      const dataToUpdate: any = {};
      if (status) dataToUpdate.status = status;
      if (verification_status) dataToUpdate.verificationStatus = verification_status;

      const updated = await tx.finding.update({
        where: { id: resolvedParams.id },
        data: dataToUpdate,
      });

      if (status && status !== existing.status) {
        await createFindingEvent(tx, {
          findingId: existing.id,
          userId: user.id,
          eventType: "status_changed",
          oldValue: existing.status,
          newValue: status,
        });
      }

      if (verification_status && verification_status !== existing.verificationStatus) {
        await createFindingEvent(tx, {
          findingId: existing.id,
          userId: user.id,
          eventType: "verification_status_changed",
          oldValue: existing.verificationStatus,
          newValue: verification_status,
        });
      }

      const trimmedComment = typeof comment === "string" ? comment.trim().slice(0, 5000) : "";
      if (trimmedComment) {
        await createFindingEvent(tx, {
          findingId: existing.id,
          userId: user.id,
          eventType: "comment",
          comment: trimmedComment,
        });
      }

      await createAuditEvent(tx, {
        userId: user.id,
        action: "finding.triage.update",
        entityType: "Finding",
        entityId: existing.id,
        metadata: {
          projectId: existing.projectId,
          scanId: existing.scanId,
          status: status ? { oldValue: existing.status, newValue: status } : undefined,
          verificationStatus: verification_status ? { oldValue: existing.verificationStatus, newValue: verification_status } : undefined,
        },
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip"),
      });

      return updated;
    });

    return NextResponse.json(finding);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Finding status update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
