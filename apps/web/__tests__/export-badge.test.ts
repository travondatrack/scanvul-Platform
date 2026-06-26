import { NextRequest } from "next/server";
import { jest } from "@jest/globals";
import { maskSecret } from "@/lib/exporters/utils";

const prismaMock = {
  scan: {
    findUnique: jest.fn(),
  },
  publicBadge: {
    findUnique: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// Default mock for authenticated user
let mockRequireActiveUser = jest.fn().mockResolvedValue({ id: "user-1", roleGlobal: "user" });
jest.mock("@/lib/session", () => ({
  requireActiveUser: () => mockRequireActiveUser(),
}));

let mockRequireScanAccess = jest.fn().mockResolvedValue(true);
jest.mock("@/lib/access", () => ({
  requireScanAccess: (...args: any[]) => mockRequireScanAccess(...args),
}));

import { GET as getReport } from "@/app/api/reports/[scanId]/route";
import { GET as getBadge } from "@/app/api/public/badge/[token]/route";

describe("Export & Badge API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireActiveUser = jest.fn().mockResolvedValue({ id: "user-1", roleGlobal: "user" });
    mockRequireScanAccess = jest.fn().mockResolvedValue(true);
  });

  describe("Report Export", () => {
    const mockScanData = {
      id: "scan-123",
      status: "completed",
      findings: [
        {
          id: "f-1",
          severity: "Critical",
          ruleId: "CWE-89",
          status: "open",
          codeSnippet: "API_KEY=ABCDEF1234567890XYZ",
          cvss4Score: 9.8,
        },
      ],
    };

    function createReq(format: string = "json") {
      return new NextRequest(`http://localhost/api/reports/scan-123?format=${format}`);
    }

    test("returns 401 if unauthorized", async () => {
      mockRequireActiveUser.mockRejectedValue(new Error("UNAUTHORIZED"));
      const res = await getReport(createReq(), { params: Promise.resolve({ scanId: "scan-123" }) });
      expect(res.status).toBe(401);
    });

    test("returns 404 if scan access denied", async () => {
      mockRequireScanAccess.mockRejectedValue(new Error("DENIED"));
      const res = await getReport(createReq(), { params: Promise.resolve({ scanId: "scan-123" }) });
      expect(res.status).toBe(404);
    });

    test("JSON masks secrets", async () => {
      (prismaMock.scan.findUnique as jest.Mock).mockResolvedValue(mockScanData);
      const res = await getReport(createReq("json"), { params: Promise.resolve({ scanId: "scan-123" }) });
      const json = await res.json();
      expect(json.findings[0].codeSnippet).toBe("API_...0XYZ");
    });

    test("SARIF structure is valid", async () => {
      (prismaMock.scan.findUnique as jest.Mock).mockResolvedValue(mockScanData);
      const res = await getReport(createReq("sarif"), { params: Promise.resolve({ scanId: "scan-123" }) });
      const sarif = await res.json();
      expect(sarif.version).toBe("2.1.0");
      expect(sarif.runs[0].results[0].level).toBe("error"); // Critical -> error
    });
  });

  describe("Public Badge Retrieval", () => {
    function createReq() {
      return new NextRequest("http://localhost/api/public/badge/token-123");
    }

    test("returns 404 if not found or inactive", async () => {
      (prismaMock.publicBadge.findUnique as jest.Mock).mockResolvedValue(null);
      const res = await getBadge(createReq(), { params: Promise.resolve({ token: "token-123" }) });
      expect(res.status).toBe(404);
    });

    test("returns 410 if expired", async () => {
      (prismaMock.publicBadge.findUnique as jest.Mock).mockResolvedValue({
        isActive: "true",
        expiresAt: new Date(Date.now() - 10000), // Expired
      });
      const res = await getBadge(createReq(), { params: Promise.resolve({ token: "token-123" }) });
      expect(res.status).toBe(410);
    });

    test("returns safe summary on success", async () => {
      (prismaMock.publicBadge.findUnique as jest.Mock).mockResolvedValue({
        isActive: "true",
        expiresAt: new Date(Date.now() + 100000),
        scan: {
          id: "scan-123",
          status: "completed",
          findings: [
            { severity: "High", status: "open", vulnType: "Injection" },
            { severity: "Low", status: "false_positive", vulnType: "Config" }, // Filtered out
          ],
        },
      });

      const res = await getBadge(createReq(), { params: Promise.resolve({ token: "token-123" }) });
      const json = await res.json();
      
      expect(res.status).toBe(200);
      expect(json.summary.findingsCount.total).toBe(1);
      expect(json.summary.findingsCount.high).toBe(1);
      // Ensure no code snippets or file paths are included in the response summary
      expect(json.summary).not.toHaveProperty("codeSnippet");
    });
  });

  describe("Secret Masker", () => {
    test("masks long secrets", () => {
      expect(maskSecret("AKIAIOSFODNN7EXAMPLE")).toBe("AKIA...MPLE");
      expect(maskSecret("short")).toBe("short"); // Unchanged because length < 16
    });
  });
});
