import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/session";
import { logAudit } from "@/lib/audit";
import { ADMIN_AUDIT_ACTIONS } from "@/lib/constants";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireGlobalAdmin();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { slug: { contains: search } },
      ];
    }

    const [organizations, total] = await Promise.all([
      prisma.organization.findMany({
        where,
        select: {
          id: true,
          name: true,
          slug: true,
          plan: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: { members: true, projects: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.organization.count({ where }),
    ]);

    await logAudit({
      userId: actor.id,
      action: ADMIN_AUDIT_ACTIONS.ORG_VIEWED,
      entityType: "organization_list",
      metadata: { count: organizations.length },
    });

    return NextResponse.json({
      organizations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin list orgs error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
