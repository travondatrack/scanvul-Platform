import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { requireScanAccess } from "@/lib/access";

type Params = { params: Promise<{ scanId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { scanId } = await params;

    try {
      await requireScanAccess(user.id, scanId, "view");
    } catch {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const scan = await prisma.scan.findUnique({
      where: { id: scanId },
      include: {
        project: {
          select: {
            id: true,
            name: true,
            repoUrl: true,
            organization: { select: { id: true, name: true, slug: true } },
          },
        },
        findings: {
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
            codeSnippet: true,
            whyVulnerable: true,
            attackScenario: true,
            impact: true,
            remediation: true,
            status: true,
            createdAt: true,
          },
          orderBy: [{ severity: "asc" }, { cvss4Score: "desc" }],
        },
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const summary = {
      total: scan.findings.length,
      critical: scan.findings.filter((f) => f.severity.toLowerCase() === "critical").length,
      high: scan.findings.filter((f) => f.severity.toLowerCase() === "high").length,
      medium: scan.findings.filter((f) => f.severity.toLowerCase() === "medium").length,
      low: scan.findings.filter((f) => f.severity.toLowerCase() === "low").length,
      info: scan.findings.filter((f) => f.severity.toLowerCase() === "info").length,
      open: scan.findings.filter((f) => f.status === "open").length,
      confirmed: scan.findings.filter((f) => f.status === "confirmed").length,
      false_positive: scan.findings.filter((f) => f.status === "false_positive").length,
      fixed: scan.findings.filter((f) => f.status === "fixed").length,
      accepted_risk: scan.findings.filter((f) => f.status === "accepted_risk").length,
    };

    return NextResponse.json({
      scan: {
        id: scan.id,
        status: scan.status,
        riskLevel: scan.riskLevel,
        riskPercent: scan.riskPercent,
        sourceType: scan.sourceType,
        sourceValue: scan.sourceValue,
        languageSummary: scan.languageSummary,
        frameworkSummary: scan.frameworkSummary,
        createdAt: scan.createdAt,
        updatedAt: scan.updatedAt,
        project: scan.project,
      },
      summary,
      findings: scan.findings,
      exportedAt: new Date().toISOString(),
      exportedBy: user.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Report export error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
