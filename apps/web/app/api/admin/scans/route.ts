import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/session";

export async function GET(req: NextRequest) {
  try {
    await requireGlobalAdmin();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "";
    const projectId = searchParams.get("projectId") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (projectId) {
      where.projectId = projectId;
    }

    const [scans, total] = await Promise.all([
      prisma.scan.findMany({
        where,
        select: {
          id: true,
          projectId: true,
          triggeredBy: true,
          sourceType: true,
          status: true,
          riskLevel: true,
          riskPercent: true,
          startedAt: true,
          completedAt: true,
          durationMs: true,
          errorMessage: true,
          createdAt: true,
          project: {
            select: { name: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.scan.count({ where }),
    ]);

    return NextResponse.json({
      scans,
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
    console.error("Admin list scans error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
