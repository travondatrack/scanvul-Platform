import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canManageFinding } from "@/lib/access";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { comment } = body;

    if (typeof comment !== "string" || !comment.trim()) {
      return NextResponse.json({ error: "Comment is required" }, { status: 400 });
    }

    const resolvedParams = await Promise.resolve(params);
    const existing = await prisma.finding.findUnique({
      where: { id: resolvedParams.id },
      select: { id: true },
    });

    if (!existing || !(await canManageFinding(user.id, resolvedParams.id))) {
      return NextResponse.json({ error: "Finding not found or unauthorized" }, { status: 404 });
    }

    const findingEvent = await prisma.findingEvent.create({
      data: {
        findingId: resolvedParams.id,
        userId: user.id,
        eventType: "comment",
        comment: comment.trim(),
      },
      include: {
        user: {
          select: { name: true, email: true, image: true },
        },
      },
    });

    return NextResponse.json(findingEvent);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Finding comment error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
