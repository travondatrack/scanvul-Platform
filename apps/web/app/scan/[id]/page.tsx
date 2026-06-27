import { prisma } from "@/lib/prisma";
import { requireScanAccess } from "@/lib/access";
import { requireActiveUser } from "@/lib/session";
import { notFound } from "next/navigation";
import { TriageDashboard } from "@/components/ui/triage-dashboard";

export default async function ScanResultPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireActiveUser();
  const resolvedParams = await Promise.resolve(params);
  try {
    await requireScanAccess(user.id, resolvedParams.id, "view");
  } catch {
    notFound();
  }

  const scan = await prisma.scan.findUnique({
    where: { id: resolvedParams.id },
    include: { 
      findings: { orderBy: { createdAt: "desc" } },
      badges: { where: { isActive: "true" }, take: 1 },
      scanEvents: { orderBy: { createdAt: "asc" } }
    }
  });

  if (!scan) notFound();

  const critical = scan.findings.filter(f => f.severity === "critical" || f.severity === "Critical").length;
  const high = scan.findings.filter(f => f.severity === "high" || f.severity === "High").length;
  const medium = scan.findings.filter(f => f.severity === "medium" || f.severity === "Medium").length;
  const low = scan.findings.filter(f => f.severity === "low" || f.severity === "Low").length;

  // Normalize findings for TriageDashboard
  const panelFindings = scan.findings.map((f) => ({
    id: f.id,
    status: f.status,
    assigneeId: f.assigneeId ?? undefined,
    severity: f.severity,
    ruleId: f.ruleId ?? "",
    scanCategory: f.scanCategory ?? "SAST source code",
    engine: f.engine,
    title: f.title,
    filePath: f.filePath,
    lineNumber: f.lineNumber,
    lineStart: f.lineStart ?? f.lineNumber,
    lineEnd: f.lineEnd ?? f.lineNumber,
    source: f.source ?? "",
    sink: f.sink ?? "",
    functionName: f.functionName ?? "",
    whyVulnerable: f.whyVulnerable ?? "",
    attackScenario: f.attackScenario ?? "",
    impact: f.impact ?? "",
    remediation: f.remediation ?? "",
    poc: f.poc ?? "",
    codeSnippet: f.codeSnippet ?? "",
    evidence: f.evidence ?? "",
    pentestHint: f.pentestHint ?? "",
    references: f.extReferences ?? "",
    cvss4: f.cvss4Score,
    confidence: f.confidence,
    verificationStatus: f.verificationStatus ?? "unverified",
    dedupeHash: f.dedupeHash ?? "",
    dataflowTrace: f.dataflowTrace ?? "",
    vulnType: f.vulnType ?? "",
    cweId: f.cweId ?? "",
    owaspCategory: f.owaspCategory ?? "",
  }));

  const stats = {
    critical,
    high,
    medium,
    low,
    total: scan.findings.length,
    riskScore: scan.riskPercent || 0
  };

  return <TriageDashboard scan={scan} findings={panelFindings} stats={stats} />;
}
