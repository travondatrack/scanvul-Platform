import { NextRequest, NextResponse } from "next/server";
import { canViewProject } from "@/lib/access";
import { getEligibleProjectAssignees } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    const finding = await prisma.finding.findUnique({
      where: { id },
      select: { projectId: true },
    });

    if (!finding?.projectId || !(await canViewProject(user.id, finding.projectId))) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    const items = await getEligibleProjectAssignees(finding.projectId);
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Finding assignees error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
