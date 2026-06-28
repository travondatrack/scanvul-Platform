import { NextRequest } from "next/server";
import { jest } from "@jest/globals";

// Mock prisma and session
const prismaMock = {
  finding: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  findingEvent: {
    create: jest.fn(),
  },
  auditEvent: {
    create: jest.fn(),
  },
  $transaction: jest.fn((callback: any) => callback(prismaMock)),
};

jest.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

jest.mock("@/lib/session", () => ({
  requireActiveUser: jest.fn().mockResolvedValue({ id: "user-1", roleGlobal: "user" }),
}));

jest.mock("@/lib/access", () => ({
  canManageFinding: jest.fn().mockResolvedValue(true),
}));

import { PATCH } from "@/app/api/findings/[id]/status/route";

describe("PATCH /api/findings/[id]/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function createRequest(body: any) {
    return new NextRequest("http://localhost/api/findings/f-1/status", {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  }

  test("rejects invalid status", async () => {
    const req = createRequest({ status: "invalid_status" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid finding status");
  });

  test("rejects invalid verification_status", async () => {
    const req = createRequest({ verification_status: "fake_verify" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Invalid verification status");
  });

  test("returns 400 if nothing to update", async () => {
    const req = createRequest({});
    const res = await PATCH(req, { params: Promise.resolve({ id: "f-1" }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe("Nothing to update");
  });

  test("updates status successfully and creates event", async () => {
    (prismaMock.finding.findFirst as jest.Mock).mockResolvedValue({
      id: "f-1",
      status: "open",
      verificationStatus: "unverified",
      projectId: "p-1",
      scanId: "s-1",
    });
    
    (prismaMock.finding.update as jest.Mock).mockResolvedValue({
      id: "f-1",
      status: "confirmed",
      verificationStatus: "unverified",
    });

    const req = createRequest({ status: "confirmed", comment: "Verified by me" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f-1" }) });
    
    expect(res.status).toBe(200);
    expect(prismaMock.finding.update).toHaveBeenCalledWith({
      where: { id: "f-1" },
      data: { status: "confirmed" },
    });
    
    expect(prismaMock.findingEvent.create).toHaveBeenCalledWith({
      data: {
        findingId: "f-1",
        userId: "user-1",
        eventType: "status_changed",
        oldValue: "open",
        newValue: "confirmed",
        comment: null,
      },
    });
    expect(prismaMock.findingEvent.create).toHaveBeenCalledWith({
      data: {
        findingId: "f-1",
        userId: "user-1",
        eventType: "comment",
        oldValue: null,
        newValue: null,
        comment: "Verified by me",
      },
    });
    expect(prismaMock.auditEvent.create).toHaveBeenCalled();
  });

  test("returns 404 if finding not found", async () => {
    (prismaMock.finding.findFirst as jest.Mock).mockResolvedValue(null);

    const req = createRequest({ status: "confirmed" });
    const res = await PATCH(req, { params: Promise.resolve({ id: "f-1" }) });
    
    expect(res.status).toBe(404);
  });
});
