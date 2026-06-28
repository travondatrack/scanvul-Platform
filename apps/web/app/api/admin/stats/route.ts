import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireGlobalAdmin } from "@/lib/session";

export async function GET() {
  try {
    await requireGlobalAdmin();

    const [
      totalUsers,
      totalProjects,
      totalScans,
      failedScans,
      queuedScans,
      runningScans,
      findingsBySeverityRaw,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.scan.count(),
      prisma.scan.count({ where: { status: "failed" } }),
      prisma.scan.count({ where: { status: "queued" } }),
      prisma.scan.count({ where: { status: "running" } }),
      prisma.finding.groupBy({
        by: ["severity"],
        _count: { severity: true },
      }),
    ]);

    const findingsBySeverity = findingsBySeverityRaw.reduce((acc, curr) => {
      acc[curr.severity] = curr._count.severity;
      return acc;
    }, {} as Record<string, number>);

    return NextResponse.json({
      totalUsers,
      totalProjects,
      totalScans,
      failedScans,
      activeScans: queuedScans + runningScans,
      queuedScans,
      runningScans,
      findingsBySeverity,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "FORBIDDEN" || error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    console.error("Admin stats error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
