import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

import { normalizeEmail } from "@/lib/auth-policy";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const MEMBER_ROLES = new Set(["admin", "member", "viewer"]);
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    const isMember = await prisma.organizationMember.findFirst({
      where: { organizationId: id, userId: user.id },
      select: { id: true },
    });

    if (!isMember && user.roleGlobal !== "admin") {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const members = await prisma.organizationMember.findMany({
      where: { organizationId: id },
      include: {
        user: { select: { id: true, name: true, email: true, image: true, status: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const items = members.map((m) => ({
      ...m,
      isMe: m.userId === user.id,
    }));

    return NextResponse.json({ items });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Organization member list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    if (!(await canManageOrganization(user.id, id, user.roleGlobal))) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const body = await req.json();
    const email = normalizeEmail(body.email);
    const role = typeof body.role === "string" ? body.role : "member";

    if (!email || !MEMBER_ROLES.has(role)) {
      return NextResponse.json({ error: "Valid email and role are required" }, { status: 400 });
    }

    const [organization, targetUser] = await Promise.all([
      prisma.organization.findUnique({
        where: { id },
        select: { id: true, name: true },
      }),
      prisma.user.findUnique({
        where: { email },
        select: { id: true, email: true },
      }),
    ]);

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existingMembership = await prisma.organizationMember.findUnique({
      where: { organizationId_userId: { organizationId: id, userId: targetUser.id } },
      select: { id: true },
    });

    if (existingMembership) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      await tx.organizationInvite.updateMany({
        where: { organizationId: id, email, status: "pending" },
        data: { status: "cancelled" },
      });

      const token = crypto.randomBytes(32).toString("hex");
      const invite = await tx.organizationInvite.create({
        data: {
          organizationId: id,
          email,
          role,
          tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
          invitedBy: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const notification = await tx.notification.create({
        data: {
          userId: targetUser.id,
          type: NOTIFICATION_TYPES.teamInvite,
          title: "You were invited to a team",
          message: `${user.name || user.email || "A team owner"} invited you to join ${organization.name} as ${role}.`,
          payload: JSON.stringify({
            inviteId: invite.id,
            organizationId: organization.id,
            organizationName: organization.name,
            role,
            invitedBy: user.id,
          }),
        },
      });

      return { invite, notification };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Organization member add error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
