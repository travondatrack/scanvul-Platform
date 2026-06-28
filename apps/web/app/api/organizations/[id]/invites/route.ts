import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const MANAGER_ROLES = ["owner", "admin"];

async function canManageOrganization(userId: string, organizationId: string, roleGlobal: string) {
  if (roleGlobal === "admin") return true;
  const membership = await prisma.organizationMember.findFirst({
    where: { organizationId, userId, role: { in: MANAGER_ROLES } },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    if (!(await canManageOrganization(user.id, id, user.roleGlobal))) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const items = await prisma.organizationInvite.findMany({
      where: { organizationId: id, status: "pending" },
      include: { inviter: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Organization invite list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    if (!(await canManageOrganization(user.id, id, user.roleGlobal))) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    const inviteId = req.nextUrl.searchParams.get("inviteId");
    if (!inviteId) {
      return NextResponse.json({ error: "inviteId is required" }, { status: 400 });
    }

    await prisma.organizationInvite.updateMany({
      where: { id: inviteId, organizationId: id, status: "pending" },
      data: { status: "cancelled" },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Organization invite cancel error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
