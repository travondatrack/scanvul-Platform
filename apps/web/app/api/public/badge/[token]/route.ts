import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ token: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { token } = await params;

    const badge = await prisma.publicBadge.findUnique({
      where: { token },
      include: {
        scan: {
          include: {
            project: {
              select: {
                name: true,
                sourceType: true,
              },
            },
            findings: {
              select: {
                id: true,
                severity: true,
                status: true,
                scanCategory: true,
                vulnType: true,
                cweId: true,
              },
            },
          },
        },
      },
    });

    if (!badge || badge.isActive !== "true") {
      return NextResponse.json({ error: "Badge not found or deactivated" }, { status: 404 });
    }

    if (badge.expiresAt < new Date()) {
      return NextResponse.json({ error: "Badge has expired" }, { status: 410 });
    }

    const scan = badge.scan;

    // Safety constraint: Make sure no file paths or snippets are returned
    const activeFindings = scan.findings.filter((f) => f.status !== "false_positive" && f.status !== "fixed");

    const summary = {
      scanId: scan.id,
      projectName: scan.project?.name || "Unknown Project",
      status: scan.status,
      riskLevel: scan.riskLevel,
      riskPercent: scan.riskPercent,
      createdAt: scan.createdAt,
      completedAt: scan.completedAt,
      findingsCount: {
        total: activeFindings.length,
        critical: activeFindings.filter((f) => f.severity.toLowerCase() === "critical").length,
        high: activeFindings.filter((f) => f.severity.toLowerCase() === "high").length,
        medium: activeFindings.filter((f) => f.severity.toLowerCase() === "medium").length,
        low: activeFindings.filter((f) => f.severity.toLowerCase() === "low").length,
        info: activeFindings.filter((f) => f.severity.toLowerCase() === "info").length,
      },
      topVulnerabilities: activeFindings
        .map(f => f.vulnType)
        .filter((v, i, a) => a.indexOf(v) === i) // Unique
        .slice(0, 5),
    };

    return NextResponse.json({
      badge: {
        expiresAt: badge.expiresAt,
        isActive: badge.isActive,
      },
      summary,
    });
  } catch (error) {
    console.error("Public badge retrieval error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
