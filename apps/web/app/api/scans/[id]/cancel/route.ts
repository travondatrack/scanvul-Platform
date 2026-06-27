import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

// POST /api/scans/[id]/cancel - Mark a stale/stuck scan as failed
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    const scan = await prisma.scan.findUnique({
      where: { id },
      include: {
        project: {
          select: { createdBy: true, organizationId: true },
        },
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    // Only queued or running scans can be cancelled
    if (scan.status !== "queued" && scan.status !== "running") {
      return NextResponse.json(
        { error: "Scan is not in a cancellable state" },
        { status: 400 }
      );
    }

    // Check ownership: project owner or org member
    const ownedByUser = scan.project?.createdBy === user.id;
    const orgMember = scan.project?.organizationId
      ? await prisma.organizationMember.findFirst({
          where: {
            organizationId: scan.project.organizationId,
            userId: user.id,
            role: { in: ["owner", "admin"] },
          },
        })
      : null;

    if (!ownedByUser && !orgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.scan.update({
      where: { id },
      data: {
        status: "failed",
        errorMessage: "Scan was manually cancelled or timed out.",
        completedAt: new Date(),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Cancel scan error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
