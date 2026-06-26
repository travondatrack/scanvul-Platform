import { NextRequest } from "next/server";
import { jest } from "@jest/globals";
import crypto from "crypto";

const prismaMock = {
  apiToken: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  scan: {
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

jest.mock("@/lib/backend", () => ({
  postBackend: jest.fn().mockResolvedValue({}),
}));

let mockRequireActiveUser = jest.fn().mockResolvedValue({ id: "user-1", roleGlobal: "user" });
jest.mock("@/lib/session", () => ({
  requireActiveUser: () => mockRequireActiveUser(),
}));

let mockCanManageProject = jest.fn().mockResolvedValue(true);
jest.mock("@/lib/access", () => ({
  canManageProject: (...args: any[]) => mockCanManageProject(...args),
}));

import { POST as triggerCiScan } from "@/app/api/ci/scan/route";
import { GET as getCiStatus } from "@/app/api/ci/scan/[id]/status/route";
import { POST as createToken } from "@/app/api/projects/[id]/tokens/route";

describe("CI/CD Integration API Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("API Token Generation", () => {
    test("creates token, stores hash, returns plaintext once", async () => {
      (prismaMock.apiToken.create as jest.Mock).mockResolvedValue({
        id: "t-1",
        name: "GitHub Actions",
        projectId: "p-1",
        scopes: "scan:create,scan:read,report:write",
        createdAt: new Date(),
      });

      const req = new NextRequest("http://localhost/api/projects/p-1/tokens", {
        method: "POST",
        body: JSON.stringify({ name: "GitHub Actions" }),
      });

      const res = await createToken(req, { params: Promise.resolve({ id: "p-1" }) });
      expect(res.status).toBe(201);
      
      const data = await res.json();
      expect(data.token).toBeDefined();
      expect(data.token.startsWith("sv_")).toBe(true);

      // Verify Prisma got the hash, not the plain text
      const createCallArgs = (prismaMock.apiToken.create as jest.Mock).mock.calls[0][0] as any;
      expect(createCallArgs.data.tokenHash).toBeDefined();
      expect(createCallArgs.data.tokenHash).not.toBe(data.token);
      
      const expectedHash = crypto.createHash("sha256").update(data.token).digest("hex");
      expect(createCallArgs.data.tokenHash).toBe(expectedHash);
    });
  });

  describe("POST /api/ci/scan", () => {
    function createReq(token: string | null) {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (token) headers.set("Authorization", `Bearer ${token}`);
      
      return new NextRequest("http://localhost/api/ci/scan", {
        method: "POST",
        headers,
        body: JSON.stringify({ sourceType: "repo_url", sourceValue: "https://github.com/foo/bar" }),
      });
    }

    test("rejects request without token", async () => {
      const res = await triggerCiScan(createReq(null));
      expect(res.status).toBe(401);
    });

    test("rejects invalid token", async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue(null);
      const res = await triggerCiScan(createReq("invalid_token"));
      expect(res.status).toBe(401);
    });

    test("accepts valid token and creates scan", async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue({
        id: "token-123",
        projectId: "p-1",
        isActive: "true",
        scopes: "scan:create,scan:read",
        project: { repoUrl: "https://github.com/foo/bar" },
      });

      (prismaMock.scan.create as jest.Mock).mockResolvedValue({
        id: "scan-999",
        projectId: "p-1",
        status: "queued",
      });

      const res = await triggerCiScan(createReq("valid_token"));
      expect(res.status).toBe(201);

      const json = await res.json();
      expect(json.scanId).toBe("scan-999");
      expect(prismaMock.scan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          projectId: "p-1",
          sourceType: "repo_url",
          status: "queued",
        }),
      });
    });
  });

  describe("GET /api/ci/scan/[id]/status", () => {
    test("returns scan status", async () => {
      (prismaMock.apiToken.findUnique as jest.Mock).mockResolvedValue({
        id: "token-123",
        projectId: "p-1",
        isActive: "true",
      });

      (prismaMock.scan.findFirst as jest.Mock).mockResolvedValue({
        id: "scan-999",
        status: "completed",
        riskLevel: "High",
      });

      const req = new NextRequest("http://localhost/api/ci/scan/scan-999/status", {
        headers: { "Authorization": "Bearer valid_token" }
      });

      const res = await getCiStatus(req, { params: Promise.resolve({ id: "scan-999" }) });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe("completed");
      expect(json.riskLevel).toBe("High");
    });
  });
});
