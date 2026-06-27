import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isValidEmail, normalizeEmail, validatePassword } from "@/lib/auth-policy";
import { checkRateLimit, rateLimitKey } from "@/lib/rate-limit";
import { createAndSendVerificationOtp } from "@/lib/email-verification";

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip")
      ?? "unknown";
    const body = await req.json();
    const { name, password } = body;
    const email = normalizeEmail(body.email);

    const limit = checkRateLimit(
      rateLimitKey("register", `${ip}:${email}`),
      { limit: 5, windowMs: 60 * 60 * 1000 },
    );

    if (!limit.allowed) {
      return NextResponse.json({ error: "Too many registration attempts" }, { status: 429 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }

    const passwordError = validatePassword(password);
    if (passwordError) {
      return NextResponse.json({ error: passwordError }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      if (!existingUser.emailVerified) {
        return NextResponse.json({
          error: "Email already registered but not verified",
          requiresVerification: true,
          email,
        }, { status: 409 });
      }

      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name: typeof name === "string" ? name.trim() : null,
        email,
        password: hashedPassword,
        emailVerified: new Date(),
        roleGlobal: "user",
        status: "active",
      },
    });

    // await createAndSendVerificationOtp(user.id, email);

    return NextResponse.json({
      message: "Registration successful",
      requiresVerification: false,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roleGlobal: user.roleGlobal,
        status: user.status,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
