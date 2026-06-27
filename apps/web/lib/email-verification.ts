import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";
import { sendVerificationEmail } from "@/lib/email";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createAndSendVerificationOtp(userId: string, email: string) {
  const otp = generateOtp();
  const now = new Date();

  // Use rounds=8 for OTP: short-lived (10 min), lower cost on free-tier CPU
  const [otpHash] = await Promise.all([
    bcrypt.hash(otp, 8),
    // Invalidate old OTPs in parallel with hashing
    prisma.emailVerificationOtp.updateMany({
      where: { userId, email, consumedAt: null },
      data: { consumedAt: now },
    }),
  ]);

  await prisma.emailVerificationOtp.create({
    data: {
      userId,
      email,
      otpHash,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  });

  // Await email sending so SMTP errors surface in logs (not fire-and-forget)
  await sendVerificationEmail({ to: email, otp }).catch((err) => {
    console.error("[email] Failed to send verification email to", email, ":", err?.message ?? err);
    throw err; // Re-throw so register route can return 500 with clear message
  });
}

export async function verifyEmailOtp(email: string, otp: string) {
  const verification = await prisma.emailVerificationOtp.findFirst({
    where: {
      email,
      consumedAt: null,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!verification) {
    return { ok: false as const, status: 400, error: "Verification code not found" };
  }

  if (verification.attempts >= OTP_MAX_ATTEMPTS) {
    return { ok: false as const, status: 429, error: "Too many incorrect verification attempts" };
  }

  if (verification.expiresAt.getTime() <= Date.now()) {
    return { ok: false as const, status: 400, error: "Verification code has expired" };
  }

  const valid = await bcrypt.compare(otp, verification.otpHash);

  if (!valid) {
    const updated = await prisma.emailVerificationOtp.update({
      where: { id: verification.id },
      data: { attempts: { increment: 1 } },
    });

    if (updated.attempts >= OTP_MAX_ATTEMPTS) {
      return { ok: false as const, status: 429, error: "Too many incorrect verification attempts" };
    }

    return { ok: false as const, status: 400, error: "Invalid verification code" };
  }

  const verifiedAt = new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: { id: verification.userId },
      data: {
        emailVerified: verifiedAt,
        status: "active",
      },
    }),
    prisma.emailVerificationOtp.update({
      where: { id: verification.id },
      data: {
        consumedAt: verifiedAt,
      },
    }),
  ]);

  return { ok: true as const };
}
