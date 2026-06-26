import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canManageFinding } from "@/lib/access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { assigneeId } = body; // can be null to unassign

    const resolvedParams = await Promise.resolve(params);
    const existing = await prisma.finding.findUnique({
      where: { id: resolvedParams.id },
      select: { id: true, assigneeId: true },
    });

    if (!existing || !(await canManageFinding(user.id, resolvedParams.id))) {
      return NextResponse.json({ error: "Finding not found or unauthorized" }, { status: 404 });
    }

    // Optionally check if assigneeId belongs to the org/project. For now just check if user exists.
    if (assigneeId) {
      const targetUser = await prisma.user.findUnique({ where: { id: assigneeId } });
      if (!targetUser) {
        return NextResponse.json({ error: "Assignee not found" }, { status: 400 });
      }
    }

    const finding = await prisma.$transaction(async (tx) => {
      const updated = await tx.finding.update({
        where: { id: resolvedParams.id },
        data: { assigneeId: assigneeId || null },
      });

      if (existing.assigneeId !== assigneeId) {
        await tx.findingEvent.create({
          data: {
            findingId: resolvedParams.id,
            userId: user.id,
            eventType: "assigned",
            oldValue: existing.assigneeId,
            newValue: assigneeId,
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
    console.error("Finding assign error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
