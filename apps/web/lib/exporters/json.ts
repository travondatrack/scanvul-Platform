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
    summary,
    findings: maskedFindings,
    generated_at: new Date().toISOString(),
    scanner_version: "1.0.0", // Hardcoded for now
    exported_by: userId,
  };
}
