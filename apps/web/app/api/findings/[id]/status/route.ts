import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const ALLOWED_STATUSES = new Set([
  "open",
  "confirmed",
  "false_positive",
  "fixed",
  "accepted_risk",
]);

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { status } = body;

    if (typeof status !== "string" || !ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ error: "Invalid finding status" }, { status: 400 });
    }

    const resolvedParams = await Promise.resolve(params);
    const existing = await prisma.finding.findFirst({
      where: { id: resolvedParams.id },
      include: {
        scan: {
          include: {
            project: {
              select: { createdBy: true },
            },
          },
        },
      },
    });

    if (!existing || existing.scan.project?.createdBy !== user.id) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    const finding = await prisma.$transaction(async (tx) => {
      const updated = await tx.finding.update({
        where: { id: resolvedParams.id },
        data: { status },
      });

      if (existing.status !== status) {
        await tx.findingEvent.create({
          data: {
            findingId: resolvedParams.id,
            userId: user.id,
            eventType: "status_changed",
            oldValue: existing.status,
            newValue: status,
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
