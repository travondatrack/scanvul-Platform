import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    BACKEND_API_BASE_URL: process.env.BACKEND_API_BASE_URL ?? "(not set)",
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "(not set)",
    NODE_ENV: process.env.NODE_ENV,
  });
}
