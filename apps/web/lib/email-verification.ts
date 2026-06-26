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
  const otpHash = await bcrypt.hash(otp, 10);
  const now = new Date();

  await prisma.emailVerificationOtp.updateMany({
    where: {
      userId,
      email,
      consumedAt: null,
    },
    data: {
      consumedAt: now,
    },
  });

  await prisma.emailVerificationOtp.create({
    data: {
      userId,
      email,
      otpHash,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    },
  });

  await sendVerificationEmail({ to: email, otp });
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
