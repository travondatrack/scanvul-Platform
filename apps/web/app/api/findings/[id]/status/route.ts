import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canManageFinding } from "@/lib/access";

const ALLOWED_STATUSES = new Set([
  "open",
  "confirmed",
  "in_progress",
  "fixed",
  "accepted_risk",
  "false_positive",
  "ignored",
  "reopened",
]);

const ALLOWED_VERIFICATION_STATUSES = new Set([
  "unverified",
  "verified",
  "failed",
  "skipped",
  "needs_review",
  "false_positive_likely",
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { status, verification_status, comment } = body;

    if (status && !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid finding status" }, { status: 400 });
    }
    
    if (verification_status && !ALLOWED_VERIFICATION_STATUSES.has(verification_status)) {
      return NextResponse.json({ error: "Invalid verification status" }, { status: 400 });
    }

    if (!status && !verification_status) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const resolvedParams = await Promise.resolve(params);
    const existing = await prisma.finding.findFirst({
      where: { id: resolvedParams.id },
      select: { id: true, status: true, verificationStatus: true },
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

      if (status && existing.status !== status) {
        await tx.findingEvent.create({
          data: {
            findingId: resolvedParams.id,
            userId: user.id,
            eventType: "status_changed",
            oldValue: existing.status,
            newValue: status,
            comment: typeof comment === "string" ? comment.trim() || null : null,
          },
        });
      }
      
      if (verification_status && existing.verificationStatus !== verification_status) {
        await tx.findingEvent.create({
          data: {
            findingId: resolvedParams.id,
            userId: user.id,
            eventType: "verification_status_changed",
            oldValue: existing.verificationStatus,
            newValue: verification_status,
            comment: typeof comment === "string" ? comment.trim() || null : null,
          },
        });
      }

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
