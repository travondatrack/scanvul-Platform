import { NextRequest, NextResponse } from "next/server";

import { isValidEmail, normalizeEmail } from "@/lib/auth-policy";
import { createAndSendVerificationOtp } from "@/lib/email-verification";
import { prisma } from "@/lib/prisma";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const body = await req.json();
    const email = normalizeEmail(body.email);

    const limit = checkRateLimit(
      rateLimitKey("resend-verification", `${ip}:${email}`),
      { limit: 3, windowMs: 60 * 60 * 1000 },
    );

    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many resend attempts" }, { status: 429 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, emailVerified: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ error: "Email is already verified" }, { status: 400 });
    }

    await createAndSendVerificationOtp(user.id, user.email!);

    return NextResponse.json({ message: "Verification code resent" });
  } catch (error) {
    console.error("Resend verification error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
