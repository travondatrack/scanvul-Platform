import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { requireScanAccess } from "@/lib/access";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

// POST /api/scans/[id]/badge — Publish a public badge for a scan
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    // Must have manage rights to publish a badge
    try {
      await requireScanAccess(user.id, id, "manage");
    } catch {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const scan = await prisma.scan.findUnique({
      where: { id },
      select: { id: true, status: true },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    if (scan.status !== "completed") {
      return NextResponse.json(
        { error: "Can only publish badge for completed scans" },
        { status: 400 },
      );
    }

    // Deactivate any existing badges for this scan
    await prisma.publicBadge.updateMany({
      where: { scanId: id },
      data: { isActive: "false" },
    });

    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90); // 90 days

    const badge = await prisma.publicBadge.create({
      data: { scanId: id, token, isActive: "true", expiresAt },
    });

    return NextResponse.json(
      {
        id: badge.id,
        token: badge.token,
        expiresAt: badge.expiresAt,
        badgeUrl: `/api/badge/${token}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Badge publish error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// DELETE /api/scans/[id]/badge — Revoke all badges for a scan
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    try {
      await requireScanAccess(user.id, id, "manage");
    } catch {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    await prisma.publicBadge.updateMany({
      where: { scanId: id },
      data: { isActive: "false" },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Badge revoke error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
