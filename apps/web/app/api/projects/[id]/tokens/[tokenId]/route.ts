import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canManageProject } from "@/lib/access";

type Params = { params: Promise<{ id: string; tokenId: string }> };

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id: projectId, tokenId } = await params;

    const canManage = await canManageProject(user.id, projectId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const token = await prisma.apiToken.findFirst({
      where: {
        id: tokenId,
        projectId,
      },
    });

    if (!token) {
      return NextResponse.json({ error: "Token not found" }, { status: 404 });
    }

    await prisma.apiToken.delete({
      where: { id: tokenId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("DELETE api token error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
