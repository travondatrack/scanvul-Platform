import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ADMIN_AUDIT_ACTIONS, GLOBAL_ROLES, isOneOf } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireGlobalAdmin();
    const resolvedParams = await Promise.resolve(params);
    const targetUserId = resolvedParams.id;

    const body = await req.json();
    const { role } = body;

    if (!isOneOf(GLOBAL_ROLES, role)) {
      return NextResponse.json({ error: "Invalid role value" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, roleGlobal: true, status: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.roleGlobal === role) {
      return NextResponse.json({ message: "Role unchanged" });
    }

    // Protection: Only super_admin can grant or revoke super_admin role
    if ((role === "super_admin" || targetUser.roleGlobal === "super_admin") && actor.roleGlobal !== "super_admin") {
      return NextResponse.json({ error: "Only super_admin can modify super_admin role" }, { status: 403 });
    }

    if (actor.id === targetUserId && (role === "super_admin" || (actor.roleGlobal !== "super_admin" && role === "admin"))) {
      return NextResponse.json({ error: "Cannot promote your own global role" }, { status: 403 });
    }

    // Check last admin protection if demoting an admin or super_admin
    if ((targetUser.roleGlobal === "admin" || targetUser.roleGlobal === "super_admin") && role !== "admin" && role !== "super_admin") {
      const activeAdminsCount = await prisma.user.count({
        where: {
          roleGlobal: { in: ["admin", "super_admin"] },
          status: "active",
        },
      });

      if (activeAdminsCount <= 1) {
        return NextResponse.json({ error: "Cannot remove role from the last active global admin" }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { roleGlobal: role },
      select: { id: true, name: true, email: true, roleGlobal: true, status: true, updatedAt: true },
    });

    await logAudit({
      userId: actor.id,
      action: ADMIN_AUDIT_ACTIONS.USER_ROLE_CHANGED,
      entityType: "user",
      entityId: targetUserId,
      metadata: {
        targetEmail: targetUser.email,
        oldRole: targetUser.roleGlobal,
        newRole: role,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin update role error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
