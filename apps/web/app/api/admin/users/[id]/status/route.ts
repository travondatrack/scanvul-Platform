import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/constants";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireGlobalAdmin();
    const resolvedParams = await Promise.resolve(params);
    const targetUserId = resolvedParams.id;

    const body = await req.json();
    const { status } = body;

    if (status !== "active" && status !== "disabled" && status !== "suspended") {
      return NextResponse.json({ error: "Invalid status value" }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, roleGlobal: true, status: true, email: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (targetUser.status === status) {
      return NextResponse.json({ message: "Status unchanged" });
    }

    // Check last admin protection if disabling or suspending an admin
    if ((targetUser.roleGlobal === "admin" || targetUser.roleGlobal === "super_admin") && status !== "active") {
      const activeAdminsCount = await prisma.user.count({
        where: {
          roleGlobal: { in: ["admin", "super_admin"] },
          status: "active",
        },
      });

      if (activeAdminsCount <= 1) {
        return NextResponse.json({ error: "Cannot disable the last active global admin" }, { status: 400 });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: { status },
      select: { id: true, name: true, email: true, roleGlobal: true, status: true, updatedAt: true },
    });

    const auditAction = status === "active" ? ADMIN_AUDIT_ACTIONS.USER_UNLOCKED : ADMIN_AUDIT_ACTIONS.USER_LOCKED;
    await logAudit({
      userId: actor.id,
      action: auditAction,
      entityType: "user",
      entityId: targetUserId,
      metadata: {
        targetEmail: targetUser.email,
        oldStatus: targetUser.status,
        newStatus: status,
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
    console.error("Admin update status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
