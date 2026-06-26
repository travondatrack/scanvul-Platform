import { maskFindingSecrets } from "./utils";

function mapSeverityToLevel(severity: string): string {
  const s = severity.toLowerCase();
  if (s === "critical" || s === "high") return "error";
  if (s === "medium") return "warning";
  if (s === "low" || s === "info") return "note";
  return "none";
}

export function generateSarifReport(scanData: any) {
  const maskedFindings = scanData.findings.map(maskFindingSecrets);

  const rulesMap = new Map();
  const results = [];

  for (const finding of maskedFindings) {
    // Collect rules
    if (!rulesMap.has(finding.ruleId)) {
      rulesMap.set(finding.ruleId, {
        id: finding.ruleId || "unknown-rule",
        name: finding.title || "Unknown Vulnerability",
        shortDescription: {
          text: finding.title,
        },
        fullDescription: {
          text: finding.whyVulnerable || finding.attackScenario || "No description provided.",
        },
        help: {
          text: finding.remediation || "No remediation provided.",
        },
        properties: {
          tags: [
            finding.scanCategory,
            finding.engine,
            finding.cweId,
            finding.owaspCategory,
          ].filter(Boolean),
          precision: finding.confidence > 0.8 ? "very-high" : "high",
          "security-severity": String(finding.cvss4Score || 0),
        },
      });
    }

    // Map result
    results.push({
      ruleId: finding.ruleId || "unknown-rule",
      level: mapSeverityToLevel(finding.severity),
      message: {
        text: finding.title,
      },
      locations: [
        {
          physicalLocation: {
            artifactLocation: {
              uri: finding.filePath || "unknown-file",
            },
            region: {
              startLine: finding.lineStart || finding.lineNumber || 1,
              endLine: finding.lineEnd || finding.lineNumber || 1,
              snippet: finding.codeSnippet ? { text: finding.codeSnippet } : undefined,
            },
          },
        },
      ],
    });
  }

  const sarif = {
    version: "2.1.0",
    $schema: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/os/schemas/sarif-schema-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "ScanVul AI",
            informationUri: "https://scanvul.ai",
            version: "1.0.0",
            rules: Array.from(rulesMap.values()),
          },
        },
        results: results,
      },
    ],
  };

  return sarif;
}
