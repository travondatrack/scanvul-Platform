import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    BACKEND_API_BASE_URL: process.env.BACKEND_API_BASE_URL ?? "(not set)",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL ?? "(not set)",
    NODE_ENV: process.env.NODE_ENV,
    SMTP: {
      host: process.env.SMTP_HOST ?? "(not set)",
      port: process.env.SMTP_PORT ?? "(not set)",
      user: process.env.SMTP_USER ?? "(not set)",
      pass: process.env.SMTP_PASS ? "✅ set" : "❌ not set",
      from: process.env.SMTP_FROM ?? "(not set)",
    },
    EMAIL_DEV_MODE: process.env.EMAIL_DEV_MODE ?? "(not set)",
  });
}
