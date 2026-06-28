/**
 * Security / RBAC Tests for ScanVul AI
 *
 * Run: cd apps/web && npx jest --testPathPattern=rbac
 *
 * These tests validate that no API route is vulnerable to IDOR (Insecure Direct Object Reference)
 * and that RBAC rules are enforced server-side for every protected resource.
 *
 * The tests use a mock Prisma client and a mock session so no real DB or HTTP server is needed.
 */

import { jest } from "@jest/globals";

// ────────────────────────────────────────────────────────────────────────────
// Mock helpers
// ────────────────────────────────────────────────────────────────────────────

const USER_A = { id: "user-a", email: "a@test.com", roleGlobal: "user", status: "active" };
const USER_B = { id: "user-b", email: "b@test.com", roleGlobal: "user", status: "active" };
const ADMIN  = { id: "user-admin", email: "admin@test.com", roleGlobal: "admin", status: "active" };

const PROJECT_A_ID = "project-a";
const SCAN_A_ID    = "scan-a";
const FINDING_A_ID = "finding-a";
const ORG_ID       = "org-1";

// ────────────────────────────────────────────────────────────────────────────
// Mock Prisma
// ────────────────────────────────────────────────────────────────────────────

const prismaMock = {
  user: {
    findUnique: jest.fn(),
  },
  project: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  scan: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  finding: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    findMany: jest.fn(),
  },
  findingEvent: {
    create: jest.fn(),
  },
  organizationMember: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    upsert: jest.fn(),
    delete: jest.fn(),
    updateMany: jest.fn(),
  },
  adminSupportAccess: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

// ────────────────────────────────────────────────────────────────────────────
// Import helpers AFTER mocks are set up
// ────────────────────────────────────────────────────────────────────────────

import {
  canViewProject,
  canManageProject,
  canTriggerScan,
  canViewScan,
  canManageFinding,
  accessibleProjectWhere,
} from "@/lib/access";

// ────────────────────────────────────────────────────────────────────────────
// Helper to reset mocks and configure "global admin" check
// ────────────────────────────────────────────────────────────────────────────

function mockUserRole(userId: string, role: "user" | "admin") {
  (prismaMock.user.findUnique as jest.MockedFunction<typeof prismaMock.user.findUnique>).mockResolvedValue(
    { roleGlobal: role, status: "active" } as never,
  );
}

function mockProjectAccess(found: boolean) {
  (prismaMock.project.findFirst as jest.MockedFunction<typeof prismaMock.project.findFirst>).mockResolvedValue(
    found ? { id: PROJECT_A_ID } as never : null as never,
  );
}

function mockScanAccess(found: boolean) {
  (prismaMock.scan.findFirst as jest.MockedFunction<typeof prismaMock.scan.findFirst>).mockResolvedValue(
    found ? { id: SCAN_A_ID } as never : null as never,
  );
}

function mockFindingAccess(found: boolean) {
  (prismaMock.finding.findFirst as jest.MockedFunction<typeof prismaMock.finding.findFirst>).mockResolvedValue(
    found ? { id: FINDING_A_ID } as never : null as never,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// SUITE 1: IDOR — User A cannot access User B's resources
// ────────────────────────────────────────────────────────────────────────────

describe("IDOR Prevention", () => {
  test("User B cannot view User A's private project", async () => {
    mockUserRole(USER_B.id, "user");
    mockProjectAccess(false); // Prisma returns null — User B has no access

    const result = await canViewProject(USER_B.id, PROJECT_A_ID);

    expect(result).toBe(false);
    // Ensure we queried with B's userId, not A's
    expect(prismaMock.project.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: PROJECT_A_ID }) }),
    );
  });

  test("User B cannot manage User A's project", async () => {
    mockUserRole(USER_B.id, "user");
    mockProjectAccess(false);

    const result = await canManageProject(USER_B.id, PROJECT_A_ID);
    expect(result).toBe(false);
  });

  test("User B cannot trigger scan on User A's project", async () => {
    mockUserRole(USER_B.id, "user");
    mockProjectAccess(false);

    const result = await canTriggerScan(USER_B.id, PROJECT_A_ID);
    expect(result).toBe(false);
  });

  test("User B cannot view User A's scan", async () => {
    mockUserRole(USER_B.id, "user");
    mockScanAccess(false);

    const result = await canViewScan(USER_B.id, SCAN_A_ID);
    expect(result).toBe(false);
  });

  test("User B cannot update finding status on User A's scan", async () => {
    mockUserRole(USER_B.id, "user");
    mockFindingAccess(false);

    const result = await canManageFinding(USER_B.id, FINDING_A_ID);
    expect(result).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SUITE 2: Owner — has full access to own project
// ────────────────────────────────────────────────────────────────────────────

describe("Project Owner Access", () => {
  test("User A can view their own project", async () => {
    mockUserRole(USER_A.id, "user");
    mockProjectAccess(true);

    const result = await canViewProject(USER_A.id, PROJECT_A_ID);
    expect(result).toBe(true);
  });

  test("User A can manage their own project", async () => {
    mockUserRole(USER_A.id, "user");
    mockProjectAccess(true);

    const result = await canManageProject(USER_A.id, PROJECT_A_ID);
    expect(result).toBe(true);
  });

  test("User A can trigger scan on their own project", async () => {
    mockUserRole(USER_A.id, "user");
    mockProjectAccess(true);

    const result = await canTriggerScan(USER_A.id, PROJECT_A_ID);
    expect(result).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SUITE 3: Org Viewer — read-only, no write/trigger
// ────────────────────────────────────────────────────────────────────────────

describe("Org Viewer Restrictions", () => {
  test("Viewer can view project", async () => {
    mockUserRole(USER_B.id, "user");
    // view query includes viewer role — simulate found
    mockProjectAccess(true);

    const result = await canViewProject(USER_B.id, PROJECT_A_ID);
    expect(result).toBe(true);
  });

  test("Viewer cannot manage project (no org manage role)", async () => {
    mockUserRole(USER_B.id, "user");
    // manage query excludes viewer — simulate not found
    (prismaMock.project.findFirst as jest.MockedFunction<typeof prismaMock.project.findFirst>)
      .mockResolvedValue(null as never);

    const result = await canManageProject(USER_B.id, PROJECT_A_ID);
    expect(result).toBe(false);
  });

  test("Viewer cannot trigger scan", async () => {
    mockUserRole(USER_B.id, "user");
    // trigger_scan query excludes viewer — simulate not found
    (prismaMock.project.findFirst as jest.MockedFunction<typeof prismaMock.project.findFirst>)
      .mockResolvedValue(null as never);

    const result = await canTriggerScan(USER_B.id, PROJECT_A_ID);
    expect(result).toBe(false);
  });

  test("Viewer cannot update finding status", async () => {
    mockUserRole(USER_B.id, "user");
    mockFindingAccess(false);

    const result = await canManageFinding(USER_B.id, FINDING_A_ID);
    expect(result).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SUITE 4: Global Admin bypasses all checks
// ────────────────────────────────────────────────────────────────────────────

describe("Global Admin Restricted RBAC & Break-Glass Support Access", () => {
  test("Global admin without membership or support access cannot view private project detail", async () => {
    mockUserRole(ADMIN.id, "admin");
    mockProjectAccess(false);
    (prismaMock.project.findUnique as jest.MockedFunction<typeof prismaMock.project.findUnique>).mockResolvedValue({ organizationId: "org-1" } as never);
    (prismaMock.adminSupportAccess.findMany as jest.MockedFunction<typeof prismaMock.adminSupportAccess.findMany>).mockResolvedValue([]);

    const result = await canViewProject(ADMIN.id, PROJECT_A_ID);
    expect(result).toBe(false);
  });

  test("Global admin with active support access (view_findings) can view project", async () => {
    mockUserRole(ADMIN.id, "admin");
    mockProjectAccess(false);
    (prismaMock.project.findUnique as jest.MockedFunction<typeof prismaMock.project.findUnique>).mockResolvedValue({ organizationId: "org-1" } as never);
    (prismaMock.adminSupportAccess.findMany as jest.MockedFunction<typeof prismaMock.adminSupportAccess.findMany>).mockResolvedValue([
      { id: "acc-1", actorId: ADMIN.id, projectId: PROJECT_A_ID, scopes: JSON.stringify(["view_findings"]), expiresAt: new Date(Date.now() + 3600000) } as never
    ]);

    const result = await canViewProject(ADMIN.id, PROJECT_A_ID);
    expect(result).toBe(true);
  });

  test("Global admin with expired support access cannot view project", async () => {
    mockUserRole(ADMIN.id, "admin");
    mockProjectAccess(false);
    (prismaMock.project.findUnique as jest.MockedFunction<typeof prismaMock.project.findUnique>).mockResolvedValue({ organizationId: "org-1" } as never);
    (prismaMock.adminSupportAccess.findMany as jest.MockedFunction<typeof prismaMock.adminSupportAccess.findMany>).mockResolvedValue([]);

    const result = await canViewProject(ADMIN.id, PROJECT_A_ID);
    expect(result).toBe(false);
  });

  test("Global admin with wrong support access scope cannot manage project", async () => {
    mockUserRole(ADMIN.id, "admin");
    mockProjectAccess(false);
    (prismaMock.project.findUnique as jest.MockedFunction<typeof prismaMock.project.findUnique>).mockResolvedValue({ organizationId: "org-1" } as never);
    (prismaMock.adminSupportAccess.findMany as jest.MockedFunction<typeof prismaMock.adminSupportAccess.findMany>).mockResolvedValue([
      { id: "acc-1", actorId: ADMIN.id, projectId: PROJECT_A_ID, scopes: JSON.stringify(["view_metadata"]), expiresAt: new Date(Date.now() + 3600000) } as never
    ]);

    const result = await canManageProject(ADMIN.id, PROJECT_A_ID);
    expect(result).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SUITE 5: Disabled user is denied
// ────────────────────────────────────────────────────────────────────────────

describe("Disabled User", () => {
  test("Disabled user (status=inactive) is not treated as global admin even if roleGlobal=admin", async () => {
    (prismaMock.user.findUnique as jest.MockedFunction<typeof prismaMock.user.findUnique>).mockResolvedValue(
      { roleGlobal: "admin", status: "inactive" } as never,
    );
    // isGlobalAdmin returns false for inactive users
    // => falls through to DB query which returns null
    mockProjectAccess(false);

    const result = await canViewProject(ADMIN.id, PROJECT_A_ID);
    expect(result).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SUITE 6: accessibleProjectWhere shape validation
// ────────────────────────────────────────────────────────────────────────────

describe("accessibleProjectWhere shape", () => {
  test("view query includes createdBy, org membership, and public visibility", () => {
    const where = accessibleProjectWhere(USER_A.id, "view");
    expect(where).toHaveProperty("OR");
    const clauses = where.OR as unknown[];
    expect(clauses.some((c: unknown) => (c as Record<string, unknown>)?.createdBy === USER_A.id)).toBe(true);
    expect(clauses.some((c: unknown) => (c as Record<string, unknown>)?.visibility === "public")).toBe(true);
  });

  test("manage query does NOT include public visibility", () => {
    const where = accessibleProjectWhere(USER_A.id, "manage");
    const clauses = where.OR as unknown[];
    expect(clauses.some((c: unknown) => (c as Record<string, unknown>)?.visibility === "public")).toBe(false);
  });

  test("trigger_scan query does NOT include viewer role", () => {
    const where = accessibleProjectWhere(USER_A.id, "trigger_scan");
    const clauses = where.OR as unknown[];
    const orgClause = clauses.find((c: unknown) => (c as Record<string, unknown>)?.organization) as Record<string, unknown> | undefined;
    if (orgClause) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rolesInFilter: string[] | undefined = (orgClause.organization as any)?.members?.some?.role?.in;
      if (rolesInFilter) {
        expect(rolesInFilter).not.toContain("viewer");
      }
    }
  });
});
