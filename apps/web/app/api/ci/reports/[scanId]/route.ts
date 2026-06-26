import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateSarifReport } from "@/lib/exporters/sarif";
import { generateJsonReport } from "@/lib/exporters/json";
import crypto from "crypto";

type Params = { params: Promise<{ scanId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash },
    });

    if (!apiToken || apiToken.isActive !== "true") {
      return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
    }

    if (!apiToken.scopes.includes("report:write") && !apiToken.scopes.includes("scan:read")) {
      return NextResponse.json({ error: "Token missing required scope" }, { status: 403 });
    }

    const { scanId } = await params;

    const scan = await prisma.scan.findFirst({
      where: {
        id: scanId,
        projectId: apiToken.projectId,
      },
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
            poc: true,
            evidence: true,
          },
        },
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format") || "json";

    if (format === "sarif") {
      const sarif = generateSarifReport(scan);
      return new NextResponse(JSON.stringify(sarif, null, 2), {
        headers: {
          "Content-Type": "application/sarif+json",
          "Content-Disposition": `attachment; filename="scan-${scanId}.sarif"`,
        },
      });
    }

    const summary = {
      total: scan.findings.length,
      critical: scan.findings.filter((f) => f.severity.toLowerCase() === "critical").length,
      high: scan.findings.filter((f) => f.severity.toLowerCase() === "high").length,
    };

    const jsonReport = generateJsonReport(scan, summary, "ci_pipeline");
    return new NextResponse(JSON.stringify(jsonReport, null, 2), {
      headers: {
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("CI report export error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
