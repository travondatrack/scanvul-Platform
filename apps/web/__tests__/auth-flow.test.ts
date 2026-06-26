import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { jest } from "@jest/globals";

const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  emailVerificationOtp: {
    updateMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(async (operations: Promise<unknown>[]) => Promise.all(operations)),
};

const mockSendVerificationEmail = jest.fn();

jest.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
jest.mock("@/lib/email", () => ({
  sendVerificationEmail: mockSendVerificationEmail,
}));

import { POST as registerPost } from "@/app/api/auth/register/route";
import { POST as resendPost } from "@/app/api/auth/resend-verification/route";
import { verifyEmailOtp } from "@/lib/email-verification";

function jsonRequest(path: string, body: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-real-ip": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

async function importAuthWithEnv(googleClientId = "", googleClientSecret = "") {
  jest.resetModules();
  process.env.GOOGLE_CLIENT_ID = googleClientId;
  process.env.GOOGLE_CLIENT_SECRET = googleClientSecret;
  jest.doMock("@/lib/prisma", () => ({ prisma: mockPrisma }));
  jest.doMock("@auth/prisma-adapter", () => ({
    PrismaAdapter: jest.fn(() => ({})),
  }));

  return import("@/lib/auth");
}

describe("authentication flow", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("register creates an unverified user and sends OTP without auto login", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null as never);
    mockPrisma.user.create.mockResolvedValue({
      id: "user-1",
      email: "new@example.com",
      name: "New User",
      roleGlobal: "user",
      status: "active",
    } as never);
    mockPrisma.emailVerificationOtp.updateMany.mockResolvedValue({ count: 0 } as never);
    mockPrisma.emailVerificationOtp.create.mockResolvedValue({ id: "otp-1" } as never);
    mockSendVerificationEmail.mockResolvedValue(undefined as never);

    const res = await registerPost(jsonRequest("/api/auth/register", {
      name: "New User",
      email: "New@Example.com",
      password: "Password1",
    }));
    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.requiresVerification).toBe(true);
    expect(mockPrisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        emailVerified: null,
        status: "active",
        roleGlobal: "user",
      }),
    });
    expect(mockPrisma.emailVerificationOtp.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: "new@example.com",
        otpHash: expect.any(String),
      }),
    });
  });

  test("credentials login is blocked when emailVerified is null", async () => {
    const { authOptions } = await importAuthWithEnv();
    const credentialsProvider = authOptions.providers.find((provider: any) => provider.id === "credentials") as any;
    const authorize = credentialsProvider.options?.authorize ?? credentialsProvider.authorize;
    const password = await bcrypt.hash("Password1", 10);

    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-2",
      email: "blocked@example.com",
      name: null,
      image: null,
      password,
      status: "active",
      roleGlobal: "user",
      emailVerified: null,
    } as never);

    await expect(authorize({
      email: "blocked@example.com",
      password: "Password1",
    })).rejects.toThrow("Email not verified");
  });

  test("verify OTP sets emailVerified and consumes the code", async () => {
    const otpHash = await bcrypt.hash("123456", 10);
    mockPrisma.emailVerificationOtp.findFirst.mockResolvedValue({
      id: "otp-2",
      userId: "user-3",
      email: "verified@example.com",
      otpHash,
      attempts: 0,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    mockPrisma.user.update.mockResolvedValue({ id: "user-3" } as never);
    mockPrisma.emailVerificationOtp.update.mockResolvedValue({ id: "otp-2" } as never);

    const result = await verifyEmailOtp("verified@example.com", "123456");

    expect(result.ok).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: "user-3" },
      data: expect.objectContaining({
        emailVerified: expect.any(Date),
        status: "active",
      }),
    });
    expect(mockPrisma.emailVerificationOtp.update).toHaveBeenCalledWith({
      where: { id: "otp-2" },
      data: expect.objectContaining({ consumedAt: expect.any(Date) }),
    });
  });

  test("wrong OTP increments attempts and rejects at the attempt limit", async () => {
    const otpHash = await bcrypt.hash("123456", 10);
    mockPrisma.emailVerificationOtp.findFirst.mockResolvedValue({
      id: "otp-3",
      userId: "user-4",
      email: "attempts@example.com",
      otpHash,
      attempts: 4,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);
    mockPrisma.emailVerificationOtp.update.mockResolvedValue({ attempts: 5 } as never);

    const result = await verifyEmailOtp("attempts@example.com", "000000");

    expect(result).toEqual({
      ok: false,
      status: 429,
      error: "Too many incorrect verification attempts",
    });
    expect(mockPrisma.emailVerificationOtp.update).toHaveBeenCalledWith({
      where: { id: "otp-3" },
      data: { attempts: { increment: 1 } },
    });
  });

  test("resend OTP is rate limited", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: "user-5",
      email: "resend-limit@example.com",
      emailVerified: null,
    } as never);
    mockPrisma.emailVerificationOtp.updateMany.mockResolvedValue({ count: 0 } as never);
    mockPrisma.emailVerificationOtp.create.mockResolvedValue({ id: "otp-4" } as never);
    mockSendVerificationEmail.mockResolvedValue(undefined as never);

    for (let index = 0; index < 3; index += 1) {
      const res = await resendPost(jsonRequest("/api/auth/resend-verification", {
        email: "resend-limit@example.com",
      }));
      expect(res.status).toBe(200);
    }

    const limited = await resendPost(jsonRequest("/api/auth/resend-verification", {
      email: "resend-limit@example.com",
    }));

    expect(limited.status).toBe(429);
  });

  test("Google provider only enables when client env is configured", async () => {
    const disabledAuth = await importAuthWithEnv();
    expect(disabledAuth.isGoogleAuthEnabled).toBe(false);
    expect(disabledAuth.authOptions.providers.some((provider: any) => provider.id === "google")).toBe(false);

    const enabledAuth = await importAuthWithEnv("google-client", "google-secret");
    expect(enabledAuth.isGoogleAuthEnabled).toBe(true);
    expect(enabledAuth.authOptions.providers.some((provider: any) => provider.id === "google")).toBe(true);
  });
});
