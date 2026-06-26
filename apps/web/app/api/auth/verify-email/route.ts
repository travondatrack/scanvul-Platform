import { NextRequest, NextResponse } from "next/server";

import { isValidEmail, normalizeEmail } from "@/lib/auth-policy";
import { verifyEmailOtp } from "@/lib/email-verification";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const body = await req.json();
    const email = normalizeEmail(body.email);
    const otp = typeof body.otp === "string" ? body.otp.trim() : "";

    const limit = checkRateLimit(
      rateLimitKey("verify-email", `${ip}:${email}`),
      { limit: 10, windowMs: 15 * 60 * 1000 },
    );

    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many verification attempts" }, { status: 429 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "A 6-digit verification code is required" }, { status: 400 });
    }

    const result = await verifyEmailOtp(email, otp);

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ message: "Email verified" });
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
