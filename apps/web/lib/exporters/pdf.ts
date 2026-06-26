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

const PdfPrinterClass = PdfPrinter as any;
const printer = new PdfPrinterClass(fonts);

export async function generatePdfReport(scanData: any, summary: any): Promise<Buffer> {
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

      { text: "Findings Details", style: "header", pageBreak: "before" },
      ...maskedFindings.map((finding: any, index: number) => {
        return [
          { text: `${index + 1}. ${finding.title}`, style: "subheader", color: finding.severity.toLowerCase() === 'critical' ? 'red' : 'black' },
          {
            table: {
              widths: ["25%", "75%"],
              body: [
                ["Severity", finding.severity],
                ["File", finding.filePath],
                ["Line", finding.lineNumber?.toString() || "Unknown"],
                ["CWE", finding.cweId || "N/A"],
                ["Category", finding.scanCategory],
                ["Engine", finding.engine],
              ],
            },
            margin: [0, 5, 0, 5],
          },
          { text: "Description", bold: true, margin: [0, 5, 0, 2] },
          { text: finding.whyVulnerable || finding.attackScenario || "No description provided." },
          { text: "Remediation", bold: true, margin: [0, 5, 0, 2] },
          { text: finding.remediation || "No remediation provided.", margin: [0, 0, 0, 15] },
        ];
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
