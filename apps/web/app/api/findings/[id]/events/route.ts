import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canViewProject, canViewScan } from "@/lib/access";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    
    const resolvedParams = await Promise.resolve(params);
    const finding = await prisma.finding.findUnique({
      where: { id: resolvedParams.id },
      select: { projectId: true, scanId: true },
    });

    if (!finding) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    // If projectId is somehow null, allow if global admin or finding belongs to scan triggered by user
    if (finding.projectId && !(await canViewProject(user.id, finding.projectId))) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (!finding.projectId && !(await canViewScan(user.id, finding.scanId))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const events = await prisma.findingEvent.findMany({
      where: { findingId: resolvedParams.id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 200,
    });
    return NextResponse.json(events);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Finding events error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
