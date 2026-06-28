import { jest } from "@jest/globals";
import { NextRequest } from "next/server";

const USER_NORMAL = { id: "user-normal", email: "normal@test.com", roleGlobal: "user", status: "active" };
const USER_ADMIN = { id: "user-admin", email: "admin@test.com", roleGlobal: "admin", status: "active" };
const USER_SUPER = { id: "user-super", email: "super@test.com", roleGlobal: "super_admin", status: "active" };

let currentSessionUser: any = USER_NORMAL;

const prismaMock: any = {
  user: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  project: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  scan: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  finding: {
    groupBy: jest.fn(),
  },
  organization: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  auditEvent: {
    create: jest.fn().mockResolvedValue({ id: "audit-1" }),
    findMany: jest.fn(),
    count: jest.fn(),
  },
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
jest.mock("@/lib/session", () => ({
  requireGlobalAdmin: jest.fn(async () => {
    if (!currentSessionUser || (currentSessionUser.roleGlobal !== "admin" && currentSessionUser.roleGlobal !== "super_admin")) {
      throw new Error("FORBIDDEN");
    }
    return currentSessionUser;
  }),
  requireActiveUser: jest.fn(async () => {
    if (!currentSessionUser) throw new Error("UNAUTHORIZED");
    if (currentSessionUser.status !== "active") throw new Error("USER_DISABLED");
    return currentSessionUser;
  }),
}));

import { GET as getStats } from "@/app/api/admin/stats/route";
import { GET as getUsers } from "@/app/api/admin/users/route";
import { PATCH as updateStatus } from "@/app/api/admin/users/[id]/status/route";
import { PATCH as updateRole } from "@/app/api/admin/users/[id]/role/route";
import { POST as cancelScan } from "@/app/api/admin/scans/[id]/cancel/route";
import { GET as getAuditEvents } from "@/app/api/admin/audit-events/route";

describe("Admin RBAC & Security Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    currentSessionUser = USER_NORMAL;
  });

  test("Non-admin cannot access /api/admin/* endpoints", async () => {
    currentSessionUser = USER_NORMAL;
    const req = new NextRequest("http://localhost/api/admin/stats");
    const res = await getStats();
    expect(res.status).toBe(403);
  });

  test("Admin can access /api/admin/* and sensitive data is not returned", async () => {
    currentSessionUser = USER_ADMIN;
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", name: "Bob", email: "bob@test.com", roleGlobal: "user", status: "active", createdAt: new Date(), updatedAt: new Date() },
    ]);
    prismaMock.user.count.mockResolvedValue(1);

    const req = new NextRequest("http://localhost/api/admin/users");
    const res = await getUsers(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.users[0]).not.toHaveProperty("password");
    expect(data.users[0]).not.toHaveProperty("tokenHash");
  });

  test("Admin lock user writes AuditEvent", async () => {
    currentSessionUser = USER_ADMIN;
    prismaMock.user.findUnique.mockResolvedValue({ id: "u1", email: "u1@test.com", roleGlobal: "user", status: "active" });
    prismaMock.user.update.mockResolvedValue({ id: "u1", status: "disabled" });

    const req = new NextRequest("http://localhost/api/admin/users/u1/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "disabled" }),
    });

    const res = await updateStatus(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(200);
    expect(prismaMock.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "ADMIN_USER_LOCKED",
          entityId: "u1",
        }),
      })
    );
  });

  test("Cannot demote or lock the last global admin", async () => {
    currentSessionUser = USER_ADMIN;
    prismaMock.user.findUnique.mockResolvedValue({ id: "u-admin", email: "admin@test.com", roleGlobal: "admin", status: "active" });
    prismaMock.user.count.mockResolvedValue(1); // only 1 active admin

    const req = new NextRequest("http://localhost/api/admin/users/u-admin/role", {
      method: "PATCH",
      body: JSON.stringify({ role: "user" }),
    });

    const res = await updateRole(req, { params: Promise.resolve({ id: "u-admin" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("last active global admin");
  });

  test("Normal user cannot self-promote or change roles", async () => {
    currentSessionUser = USER_NORMAL;
    const req = new NextRequest("http://localhost/api/admin/users/u1/role", {
      method: "PATCH",
      body: JSON.stringify({ role: "admin" }),
    });

    const res = await updateRole(req, { params: Promise.resolve({ id: "u1" }) });
    expect(res.status).toBe(403);
  });

  test("Cancel scan only applies to queued or running scans", async () => {
    currentSessionUser = USER_ADMIN;
    prismaMock.scan.findUnique.mockResolvedValue({ id: "s1", status: "completed", projectId: "p1" });

    const req = new NextRequest("http://localhost/api/admin/scans/s1/cancel", { method: "POST" });
    const res = await cancelScan(req, { params: Promise.resolve({ id: "s1" }) });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Only queued or running");
  });

  test("Audit log endpoint is accessible read-only for admin", async () => {
    currentSessionUser = USER_ADMIN;
    prismaMock.auditEvent.findMany.mockResolvedValue([
      { id: "a1", action: "ADMIN_USER_LOCKED", metadata: '{"reason":"spam"}', createdAt: new Date() },
    ]);
    prismaMock.auditEvent.count.mockResolvedValue(1);

    const req = new NextRequest("http://localhost/api/admin/audit-events");
    const res = await getAuditEvents(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.events[0].metadata).toEqual({ reason: "spam" });
  });
});
