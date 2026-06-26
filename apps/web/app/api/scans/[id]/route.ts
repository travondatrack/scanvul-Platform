import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { requireScanAccess } from "@/lib/access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    try {
      await requireScanAccess(user.id, id, "view");
    } catch {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const scan = await prisma.scan.findUnique({
      where: { id },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            repoUrl: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
        _count: { select: { findings: true } },
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json(scan);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Scan detail error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
