import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { requireProjectAccess } from "@/lib/access";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    try {
      await requireProjectAccess(user.id, id, "view");
    } catch {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const scans = await prisma.scan.findMany({
      where: { projectId: id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        status: true,
        riskLevel: true,
        riskPercent: true,
        sourceType: true,
        sourceValue: true,
        triggeredBy: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { findings: true } },
      },
    });

    return NextResponse.json({ items: scans });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Project scans list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
