import { NextRequest, NextResponse } from "next/server";
import { BackendError, postBackend } from "@/lib/backend";

// In-memory rate limit — mirrors FastAPI's guest rate limit for early rejection
// This prevents unnecessary round-trips to the backend when the client is clearly abusing
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();
const GUEST_LIMIT = 5;
const WINDOW_MS = 3600 * 1000; // 1 hour

function checkRateLimit(ip: string): number {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  let count = 1;
  let expiresAt = now + WINDOW_MS;

  if (entry && now <= entry.expiresAt) {
    count = entry.count + 1;
    expiresAt = entry.expiresAt;
  }

  rateLimitMap.set(ip, { count, expiresAt });

  if (count > GUEST_LIMIT) {
    return -1; // over limit
  }
  return GUEST_LIMIT - count; // remaining
}

export async function POST(req: NextRequest) {
  try {
    // Early IP-based rate limiting (mirrors FastAPI's own check)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";

    const remaining = checkRateLimit(ip);
    if (remaining < 0) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Maximum 5 guest scans per hour." },
        { status: 429, headers: { "Retry-After": "3600" } },
      );
    }

    // Parse + forward to FastAPI guest endpoint
    const body = await req.json();

    // Delegate entirely to FastAPI — it creates the scan record in its own DB,
    // dispatches the worker, and handles all validation.
    const result = await postBackend<{
      message: string;
      scanId: string;
      remainingQuota: number;
    }>("scans/guest", {
      sourceType: body.sourceType ?? "paste",
      sourceValue: body.sourceValue ?? body.codeSnippet,
      language: body.language,
    });

    return NextResponse.json({
      message: result.message,
      scanId: result.scanId,
      remainingQuota: result.remainingQuota,
    });
  } catch (error) {
    if (error instanceof BackendError) {
      if (error.status === 429) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Maximum 5 guest scans per hour." },
          { status: 429, headers: { "Retry-After": "3600" } },
        );
      }
      if (error.status === 400 || error.status === 413) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      if (error.status === 503 || error.status === 0) {
        return NextResponse.json(
          { error: "Scan engine is currently unavailable. Please try again later." },
          { status: 503 },
        );
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.error("Guest scan error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
