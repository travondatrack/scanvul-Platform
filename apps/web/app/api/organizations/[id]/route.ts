import { NextRequest, NextResponse } from "next/server";

import { createNotifications } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const MANAGER_ROLES = ["owner", "admin"];

async function canDeleteOrganization(userId: string, organizationId: string, roleGlobal: string) {
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

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    if (!(await canDeleteOrganization(user.id, id, user.roleGlobal))) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        members: { select: { userId: true } },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    await prisma.organization.delete({ where: { id } });

    await createNotifications(
      organization.members.map((member) => ({
        userId: member.userId,
        type: "team_deleted",
        title: "Team deleted",
        message: `${organization.name} was deleted.`,
        payload: {
          organizationId: organization.id,
          organizationName: organization.name,
          deletedBy: user.id,
        },
      })),
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Organization deletion error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
