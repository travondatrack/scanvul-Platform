import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    await requireGlobalAdmin();

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId") || "";
    const action = searchParams.get("action") || "";
    const entityType = searchParams.get("entityType") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (userId) where.userId = userId;
    if (action) where.action = { contains: action };
    if (entityType) where.entityType = entityType;

    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.auditEvent.count({ where }),
    ]);

    // Parse metadata JSON strings safely if needed
    const safeEvents = events.map((ev) => {
      let parsedMetadata = null;
      if (ev.metadata) {
        try {
          parsedMetadata = JSON.parse(ev.metadata);
        } catch {
          parsedMetadata = ev.metadata;
        }
      }
      return {
        ...ev,
        metadata: parsedMetadata,
      };
    });

    return NextResponse.json({
      events: safeEvents,
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
    console.error("Admin list audit events error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
