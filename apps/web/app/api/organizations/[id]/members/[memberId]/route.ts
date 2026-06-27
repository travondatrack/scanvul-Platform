import { NextRequest, NextResponse } from "next/server";

import { createNotification, createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const MEMBER_ROLES = new Set(["owner", "admin", "member", "viewer"]);
const MANAGER_ROLES = ["owner", "admin"];

async function canManageOrganization(userId: string, organizationId: string, roleGlobal: string) {
  if (roleGlobal === "admin") return true;
  const membership = await prisma.organizationMember.findFirst({
    where: {
      organizationId,
      userId,
      role: { in: MANAGER_ROLES },
    },
    select: { id: true },
  });
  return Boolean(membership);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const user = await requireActiveUser();
    const { id, memberId } = await params;
    if (!(await canManageOrganization(user.id, id, user.roleGlobal))) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const body = await req.json();
    const role = typeof body.role === "string" ? body.role : "";
    if (!MEMBER_ROLES.has(role)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: id },
    });

    if (!membership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: id, role: "owner" },
    });

    if (membership.role === "owner" && role !== "owner" && ownerCount <= 1) {
      return NextResponse.json({ error: "Organization must keep at least one owner" }, { status: 400 });
    }

    const updated = await prisma.organizationMember.update({
      where: { id: memberId },
      data: { role },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Organization member update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  try {
    const user = await requireActiveUser();
    const { id, memberId } = await params;
    const membership = await prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId: id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        organization: {
          select: {
            id: true,
            name: true,
            members: { select: { userId: true } },
          },
        },
      },
    });

    if (!membership) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    const isSelfLeave = membership.userId === user.id;
    if (!isSelfLeave && !(await canManageOrganization(user.id, id, user.roleGlobal))) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const ownerCount = await prisma.organizationMember.count({
      where: { organizationId: id, role: "owner" },
    });

    if (membership.role === "owner" && ownerCount <= 1) {
      return NextResponse.json({ error: "Organization must keep at least one owner" }, { status: 400 });
    }

    await prisma.organizationMember.delete({ where: { id: memberId } });

    if (isSelfLeave) {
      const remainingMemberIds = membership.organization.members
        .map((member) => member.userId)
        .filter((memberUserId) => memberUserId !== user.id);

      await createNotifications(
        remainingMemberIds.map((userId) => ({
          userId,
          type: "team_member_left",
          title: "A member left your team",
          message: `${membership.user.name || membership.user.email || "A member"} left ${membership.organization.name}.`,
          payload: {
            organizationId: membership.organization.id,
            organizationName: membership.organization.name,
            userId: membership.userId,
          },
        })),
      );
    } else {
      await createNotification({
        userId: membership.userId,
        type: "team_member_removed",
        title: "You were removed from a team",
        message: `You were removed from ${membership.organization.name}.`,
        payload: {
          organizationId: membership.organization.id,
          organizationName: membership.organization.name,
          removedBy: user.id,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Organization member delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
