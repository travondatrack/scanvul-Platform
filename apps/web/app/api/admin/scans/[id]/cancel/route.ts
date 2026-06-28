import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/constants";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireGlobalAdmin();
    const resolvedParams = await Promise.resolve(params);
    const scanId = resolvedParams.id;

    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { id: true, status: true, projectId: true },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (scan.status !== "queued" && scan.status !== "running") {
      return NextResponse.json({ error: "Only queued or running scans can be cancelled" }, { status: 400 });
    }

    const updatedScan = await prisma.scan.update({
      where: { id: scanId },
      data: {
        status: "cancelled",
        completedAt: new Date(),
        errorMessage: "Cancelled by Admin intervention",
      },
      select: { id: true, status: true, completedAt: true, errorMessage: true },
    });

    await logAudit({
      userId: actor.id,
      action: ADMIN_AUDIT_ACTIONS.SCAN_CANCELLED,
      entityType: "scan",
      entityId: scanId,
      metadata: {
        projectId: scan.projectId,
        oldStatus: scan.status,
      },
    });

    return NextResponse.json(updatedScan);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin cancel scan error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
