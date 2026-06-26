import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { requireScanAccess } from "@/lib/access";

const PAGE_SIZE = 50;

const SEVERITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    try {
      await requireScanAccess(user.id, id, "view");
    } catch {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const severity = searchParams.get("severity");
    const status = searchParams.get("status");
    const engine = searchParams.get("engine");

    const where: Record<string, unknown> = { scanId: id };
    if (severity) where.severity = severity.toLowerCase();
    if (status) where.status = status;
    if (engine) where.engine = engine;

    const [total, findings] = await Promise.all([
      prisma.finding.count({ where }),
      prisma.finding.findMany({
        where,
        orderBy: [{ severity: "asc" }, { cvss4Score: "desc" }, { createdAt: "asc" }],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
        select: {
          id: true,
          ruleId: true,
          scanCategory: true,
          engine: true,
          title: true,
          vulnType: true,
          severity: true,
          cvss4Score: true,
          confidence: true,
          verificationStatus: true,
          cweId: true,
          owaspCategory: true,
          filePath: true,
          lineNumber: true,
          lineStart: true,
          lineEnd: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    // Sort by severity level after fetch
    findings.sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity.toLowerCase()] ?? 99) -
        (SEVERITY_ORDER[b.severity.toLowerCase()] ?? 99),
    );

    return NextResponse.json({
      items: findings,
      total,
      page,
      pageSize: PAGE_SIZE,
      totalPages: Math.ceil(total / PAGE_SIZE),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Scan findings list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
