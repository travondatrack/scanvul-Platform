/**
 * Scan Workflow Integration Tests
 *
 * Tests the contract between Next.js API routes and FastAPI backend.
 * Uses mocked Prisma and backend fetch to test all paths without real services.
 *
 * Run: cd apps/web && npm run test:scan-workflow
 */

import { jest } from "@jest/globals";

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const USER_A = { id: "user-a", email: "a@test.com", roleGlobal: "user", status: "active" };
const USER_B = { id: "user-b", email: "b@test.com", roleGlobal: "user", status: "active" };

const PROJECT_ID = "project-123";
const SCAN_ID = "scan-abc";

// ─── Mock Prisma ──────────────────────────────────────────────────────────────

const prismaMock = {
  project: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
  },
  scan: {
    create: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
  organizationMember: {
    findFirst: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// ─── Mock global fetch (backend calls) ───────────────────────────────────────

const fetchMock = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = fetchMock;

function mockFetchOk(body: unknown = {}) {
  fetchMock.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response);
}

function mockFetchError(status: number, detail = "Error") {
  fetchMock.mockResolvedValueOnce({
    ok: false,
    status,
    statusText: detail,
    json: async () => ({ detail }),
    arrayBuffer: async () => new ArrayBuffer(0),
  } as Response);
}

function mockFetchNetworkFailure() {
  fetchMock.mockRejectedValueOnce(new Error("ECONNREFUSED"));
}

// ─── Mock session ─────────────────────────────────────────────────────────────

jest.mock("@/lib/session", () => ({
  requireActiveUser: jest.fn(),
  getCurrentUser: jest.fn(),
  requireUser: jest.fn(),
}));

import { requireActiveUser } from "@/lib/session";
const mockRequireActiveUser = requireActiveUser as jest.MockedFunction<typeof requireActiveUser>;

// ─── Mock access ──────────────────────────────────────────────────────────────

jest.mock("@/lib/access", () => ({
  requireProjectAccess: jest.fn(),
  requireScanAccess: jest.fn(),
  canViewProject: jest.fn(),
  canManageProject: jest.fn(),
  canTriggerScan: jest.fn(),
  accessibleProjectWhere: jest.fn(() => ({ OR: [{ createdBy: "user-a" }] })),
  accessibleScanWhere: jest.fn(() => ({ project: {} })),
}));

import { requireProjectAccess, requireScanAccess } from "@/lib/access";
const mockRequireProjectAccess = requireProjectAccess as jest.MockedFunction<typeof requireProjectAccess>;
const mockRequireScaAccess = requireScanAccess as jest.MockedFunction<typeof requireScanAccess>;

// ─── Import routes AFTER mocks ────────────────────────────────────────────────

// We import the handler functions directly and call them with mock NextRequest objects
// to avoid spinning up a real HTTP server.

import { BackendError } from "@/lib/backend";

function makeRequest(body?: unknown, headers?: Record<string, string>) {
  return {
    json: async () => body ?? {},
    headers: {
      get: (key: string) => headers?.[key] ?? null,
    },
    url: "http://localhost/api/scans/trigger",
  } as unknown as import("next/server").NextRequest;
}

// ─── SUITE 1: Trigger project scan ───────────────────────────────────────────

describe("POST /api/scans/trigger — Authenticated project scan", () => {
  beforeEach(() => jest.clearAllMocks());

  test("✅ Trigger succeeds: creates scan record + calls backend", async () => {
    mockRequireActiveUser.mockResolvedValue(USER_A as never);
    (prismaMock.project.findUnique as jest.Mock).mockResolvedValue({ id: PROJECT_ID, repoUrl: "https://github.com/org/repo" } as never);
    mockRequireProjectAccess.mockResolvedValue(undefined as never);
    (prismaMock.scan.findFirst as jest.Mock).mockResolvedValue(null as never); // no running scan
    (prismaMock.scan.create as jest.Mock).mockResolvedValue({
      id: SCAN_ID,
      projectId: PROJECT_ID,
      status: "queued",
      sourceType: "repo_url",
      createdAt: new Date(),
    } as never);
    mockFetchOk({ status: "accepted", scanId: SCAN_ID });

    // Dynamic import to get fresh module with mocks applied
    const { POST } = await import("@/app/api/scans/trigger/route");
    const req = makeRequest({ projectId: PROJECT_ID, repoUrl: "https://github.com/org/repo" });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(prismaMock.scan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ projectId: PROJECT_ID, status: "queued" }),
      }),
    );
    // Verify it called the canonical plural URL
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/scans/${SCAN_ID}/trigger`),
      expect.anything(),
    );
  });

  test("❌ Backend down → scan marked failed, returns 503", async () => {
    mockRequireActiveUser.mockResolvedValue(USER_A as never);
    (prismaMock.project.findUnique as jest.Mock).mockResolvedValue({ id: PROJECT_ID } as never);
    mockRequireProjectAccess.mockResolvedValue(undefined as never);
    (prismaMock.scan.findFirst as jest.Mock).mockResolvedValue(null as never);
    (prismaMock.scan.create as jest.Mock).mockResolvedValue({ id: SCAN_ID, status: "queued" } as never);
    mockFetchNetworkFailure(); // backend unreachable
    (prismaMock.scan.update as jest.Mock).mockResolvedValue({ id: SCAN_ID, status: "failed" } as never);

    const { POST } = await import("@/app/api/scans/trigger/route");
    const req = makeRequest({ projectId: PROJECT_ID, repoUrl: "https://github.com/org/repo" });
    const res = await POST(req);

    expect(res.status).toBe(503);
    // Scan must be marked failed immediately
    expect(prismaMock.scan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "failed" } }),
    );
  });

  test("🔒 User B cannot trigger scan on User A's project (IDOR)", async () => {
    mockRequireActiveUser.mockResolvedValue(USER_B as never);
    (prismaMock.project.findUnique as jest.Mock).mockResolvedValue({ id: PROJECT_ID } as never);
    // requireProjectAccess throws FORBIDDEN for User B
    mockRequireProjectAccess.mockRejectedValue(new Error("FORBIDDEN") as never);

    const { POST } = await import("@/app/api/scans/trigger/route");
    const req = makeRequest({ projectId: PROJECT_ID, repoUrl: "https://github.com/org/repo" });
    const res = await POST(req);

    expect(res.status).toBe(404); // deliberately opaque
    expect(prismaMock.scan.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("⚠️ Idempotency: returns 409 if scan is already running", async () => {
    mockRequireActiveUser.mockResolvedValue(USER_A as never);
    (prismaMock.project.findUnique as jest.Mock).mockResolvedValue({ id: PROJECT_ID } as never);
    mockRequireProjectAccess.mockResolvedValue(undefined as never);
    (prismaMock.scan.findFirst as jest.Mock).mockResolvedValue({ id: SCAN_ID } as never); // running scan found

    const { POST } = await import("@/app/api/scans/trigger/route");
    const req = makeRequest({ projectId: PROJECT_ID, repoUrl: "https://github.com/org/repo" });
    const res = await POST(req);

    expect(res.status).toBe(409);
    expect(prismaMock.scan.create).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test("❌ Missing projectId returns 400", async () => {
    mockRequireActiveUser.mockResolvedValue(USER_A as never);

    const { POST } = await import("@/app/api/scans/trigger/route");
    const req = makeRequest({ repoUrl: "https://github.com/org/repo" }); // no projectId
    const res = await POST(req);

    expect(res.status).toBe(400);
    expect(prismaMock.scan.create).not.toHaveBeenCalled();
  });
});

// ─── SUITE 2: Guest scan ──────────────────────────────────────────────────────

describe("POST /api/scans/guest — Unauthenticated guest scan", () => {
  beforeEach(() => jest.clearAllMocks());

  test("✅ Guest scan delegates to correct FastAPI endpoint", async () => {
    mockFetchOk({
      message: "Scan queued successfully",
      scanId: "guest-scan-xyz",
      remainingQuota: 4,
    });

    const { POST } = await import("@/app/api/scans/guest/route");
    const req = makeRequest(
      { sourceType: "paste", sourceValue: '[{"path":"test.py","content":"print(1)"}]' },
      { "x-forwarded-for": "10.0.0.1" },
    );
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.scanId).toBe("guest-scan-xyz");

    // Must call FastAPI at the correct URL — /api/v1/scans/guest (plural, no typo)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/v1/scans/guest"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  test("🚦 Guest scan rate limit: 6th request returns 429", async () => {
    // Reset module to get a fresh in-memory rate limit store
    jest.resetModules();
    const { POST } = await import("@/app/api/scans/guest/route");

    const ip = "10.0.0.99";

    // First 5 should pass (mocked as OK)
    for (let i = 0; i < 5; i++) {
      mockFetchOk({ message: "Scan queued", scanId: `s${i}`, remainingQuota: 4 - i });
      const req = makeRequest(
        { sourceType: "paste", sourceValue: '[{"path":"f.py","content":"x=1"}]' },
        { "x-forwarded-for": ip },
      );
      const res = await POST(req);
      expect(res.status).not.toBe(429);
    }

    // 6th must be 429 (no fetch call to backend)
    const req = makeRequest(
      { sourceType: "paste", sourceValue: '[{"path":"f.py","content":"x=1"}]' },
      { "x-forwarded-for": ip },
    );
    const res = await POST(req);
    expect(res.status).toBe(429);
  });

  test("❌ Backend down during guest scan returns 503", async () => {
    mockFetchError(503, "Scan engine unavailable");

    const { POST } = await import("@/app/api/scans/guest/route");
    const req = makeRequest(
      { sourceType: "paste", sourceValue: '[{"path":"a.py","content":"y=2"}]' },
      { "x-forwarded-for": "10.0.0.2" },
    );
    const res = await POST(req);

    expect(res.status).toBe(503);
  });
});

// ─── SUITE 3: Scan not found ──────────────────────────────────────────────────

describe("Scan not found → 404", () => {
  beforeEach(() => jest.clearAllMocks());

  test("GET /api/scans/[id] — scan not found returns 404", async () => {
    mockRequireActiveUser.mockResolvedValue(USER_A as never);
    mockRequireScaAccess.mockRejectedValue(new Error("FORBIDDEN") as never);

    const { GET } = await import("@/app/api/scans/[id]/route");
    const req = makeRequest();
    const res = await GET(req, { params: Promise.resolve({ id: "nonexistent-scan" }) });

    expect(res.status).toBe(404);
  });
});
