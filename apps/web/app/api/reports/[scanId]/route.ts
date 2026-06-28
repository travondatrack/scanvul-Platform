import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { requireScanAccess } from "@/lib/access";
import { generateJsonReport } from "@/lib/exporters/json";
import { generateSarifReport } from "@/lib/exporters/sarif";
import { generatePdfReport } from "@/lib/exporters/pdf";

type Params = { params: Promise<{ scanId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { scanId } = await params;
    
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

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
            secureExample: true,
            pentestHint: true,
            extReferences: true,
            codeLink: true,
            dedupeHash: true,
            source: true,
            sink: true,
            status: true,
            createdAt: true,
            poc: true,
            evidence: true,
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
      riskScore: scan.riskPercent ?? 0,
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
      topAffectedFiles: Object.entries(scan.findings.reduce<Record<string, number>>((acc, f) => {
        acc[f.filePath] = (acc[f.filePath] ?? 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([filePath, count]) => ({ filePath, count })),
      byEngine: Object.entries(scan.findings.reduce<Record<string, number>>((acc, f) => {
        acc[f.engine] = (acc[f.engine] ?? 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1]).map(([engine, count]) => ({ engine, count })),
      byOwaspCategory: Object.entries(scan.findings.reduce<Record<string, number>>((acc, f) => {
        const key = f.owaspCategory || "Unmapped";
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      }, {})).sort((a, b) => b[1] - a[1]).map(([category, count]) => ({ category, count })),
    };

    if (format === "sarif") {
      const sarif = generateSarifReport(scan);
      return new NextResponse(JSON.stringify(sarif, null, 2), {
        headers: {
          "Content-Type": "application/sarif+json",
          "Content-Disposition": `attachment; filename="scan-${scanId}.sarif"`,
        },
      });
    }

    if (format === "pdf") {
      const pdfBuffer = await generatePdfReport(scan, summary);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="scan-${scanId}.pdf"`,
        },
      });
    }

    // Default to JSON
    const jsonReport = generateJsonReport(scan, summary, user.id);
    return new NextResponse(JSON.stringify(jsonReport, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="scan-${scanId}.json"`,
      },
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
