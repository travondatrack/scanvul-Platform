import { maskFindingSecrets } from "./utils";

export function generateJsonReport(scanData: any, summary: any, userId: string) {
  const maskedFindings = scanData.findings.map(maskFindingSecrets);

  return {
    scan: {
      id: scanData.id,
      status: scanData.status,
      riskLevel: scanData.riskLevel,
      riskPercent: scanData.riskPercent,
      sourceType: scanData.sourceType,
      sourceValue: scanData.sourceValue,
      languageSummary: scanData.languageSummary,
      frameworkSummary: scanData.frameworkSummary,
      createdAt: scanData.createdAt,
      updatedAt: scanData.updatedAt,
      project: scanData.project,
    },
    executiveSummary: {
      riskLevel: scanData.riskLevel,
      riskScore: summary.riskScore ?? scanData.riskPercent ?? 0,
      totalFindings: summary.total,
      topAffectedFiles: summary.topAffectedFiles ?? [],
      byEngine: summary.byEngine ?? [],
      byOwaspCategory: summary.byOwaspCategory ?? [],
    },
    summary,
    findings: maskedFindings,
    generated_at: new Date().toISOString(),
    scanner_version: "1.0.0", // Hardcoded for now
    exported_by: userId,
  };
}
