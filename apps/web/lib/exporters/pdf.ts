import PdfPrinter from "pdfmake";
import { TDocumentDefinitions } from "pdfmake/interfaces";
import { maskFindingSecrets } from "./utils";

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

export async function generatePdfReport(scanData: any, summary: any): Promise<Buffer> {
  const PdfPrinterClass = (PdfPrinter as any).default || PdfPrinter;
  const printer = new PdfPrinterClass(fonts);

  const maskedFindings = scanData.findings.map(maskFindingSecrets);

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: {
      font: "Helvetica",
      fontSize: 10,
    },
    content: [
      { text: "ScanVul AI Security Report", style: "header", alignment: "center" },
      { text: `Project: ${scanData.project?.name || scanData.sourceValue || "Unknown"}`, style: "subheader", alignment: "center" },
      { text: `Generated At: ${new Date().toISOString()}`, alignment: "center", margin: [0, 0, 0, 20] },
      
      { text: "Executive Summary", style: "header" },
      {
        table: {
          widths: ["*", "*"],
          body: [
            ["Status", scanData.status],
            ["Risk Level", scanData.riskLevel],
            ["Risk Score", `${summary.riskScore ?? scanData.riskPercent ?? 0}%`],
            ["Total Findings", summary.total.toString()],
          ],
        },
        margin: [0, 0, 0, 10],
      },

      { text: "Severity Distribution", style: "subheader" },
      {
        table: {
          widths: ["*", "*", "*", "*", "*"],
          body: [
            [
              { text: "Critical", bold: true, color: "red" },
              { text: "High", bold: true, color: "orange" },
              { text: "Medium", bold: true, color: "#b8860b" },
              { text: "Low", bold: true, color: "green" },
              { text: "Info", bold: true, color: "blue" },
            ],
            [
              summary.critical.toString(),
              summary.high.toString(),
              summary.medium.toString(),
              summary.low.toString(),
              summary.info.toString(),
            ],
          ],
        },
        margin: [0, 0, 0, 20],
      },

      { text: "Top Affected Files", style: "subheader" },
      {
        ul: (summary.topAffectedFiles?.length ? summary.topAffectedFiles : [{ filePath: "None", count: 0 }]).map((item: any) => `${item.filePath} (${item.count})`),
        margin: [0, 0, 0, 12],
      },

      { text: "Findings by Engine", style: "subheader" },
      {
        ul: (summary.byEngine?.length ? summary.byEngine : [{ engine: "None", count: 0 }]).map((item: any) => `${item.engine} (${item.count})`),
        margin: [0, 0, 0, 12],
      },

      { text: "Findings by OWASP Category", style: "subheader" },
      {
        ul: (summary.byOwaspCategory?.length ? summary.byOwaspCategory : [{ category: "None", count: 0 }]).map((item: any) => `${item.category} (${item.count})`),
        margin: [0, 0, 0, 20],
      },

      { text: "Findings Details", style: "header", pageBreak: "before" },
      ...maskedFindings.map((finding: any, index: number) => {
        const nodes: any[] = [
          { text: `${index + 1}. ${finding.title}`, style: "subheader", color: finding.severity.toLowerCase() === 'critical' ? 'red' : 'black' },
          {
            table: {
              widths: ["25%", "75%"],
              body: [
                ["Severity", finding.severity],
                ["File", finding.filePath],
                ["Line", finding.lineNumber?.toString() || "Unknown"],
                ["CWE", finding.cweId || "N/A"],
                ["OWASP", finding.owaspCategory || "N/A"],
                ["Category", finding.scanCategory],
                ["Engine", finding.engine],
                ["Confidence", `${Math.round((finding.confidence || 0) * 100)}%`],
              ],
            },
            margin: [0, 5, 0, 5],
          },
          { text: "Description", bold: true, margin: [0, 5, 0, 2] },
          { text: finding.whyVulnerable || finding.attackScenario || "No description provided." },
          { text: "Remediation", bold: true, margin: [0, 5, 0, 2] },
          { text: finding.remediation || "No remediation provided." },
        ];
        if (finding.secureExample) {
          nodes.push(
            { text: "Secure Example", bold: true, margin: [0, 5, 0, 2] },
            { text: finding.secureExample },
          );
        }
        nodes.push(
          { text: "Pentest Guidance", bold: true, margin: [0, 5, 0, 2] },
          { text: finding.pentestHint || "Validate manually in an authorized non-production environment and avoid destructive actions.", margin: [0, 0, 0, 15] },
        );
        return nodes;
      }),
    ],
    styles: {
      header: {
        fontSize: 18,
        bold: true,
        margin: [0, 10, 0, 10],
      },
      subheader: {
        fontSize: 14,
        bold: true,
        margin: [0, 10, 0, 5],
      },
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks: Buffer[] = [];
      pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (err: Error) => reject(err));
      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
}
