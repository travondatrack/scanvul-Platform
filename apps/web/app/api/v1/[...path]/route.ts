import { NextRequest, NextResponse } from "next/server";

import { accessibleScanWhere, requireProjectAccess, requireScanAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const BACKEND_BASE =
  process.env.BACKEND_API_BASE_URL ??
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  "http://127.0.0.1:8000";
const INTERNAL_API_SECRET = process.env.INTERNAL_API_SECRET ?? "";

function normalizeProxyPath(path: string[]) {
  if (!Array.isArray(path) || path.length === 0) {
    throw new Error("BAD_PATH");
  }

  return path.map((segment) => {
    if (!segment || segment === "." || segment === "..") {
      throw new Error("BAD_PATH");
    }
    if (/%(?:00|2e|2f|5c)/i.test(segment)) {
      throw new Error("BAD_PATH");
    }

    let decoded = segment;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      throw new Error("BAD_PATH");
    }

    if (
      !decoded ||
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("\0")
    ) {
      throw new Error("BAD_PATH");
    }

    return decoded;
  });
}

// ─── Authorization gate ───────────────────────────────────────────────────────

/**
 * Determine what authorization is required for a given method + path segments,
 * then enforce it. Returns a routing decision string.
 *
 * Path examples (path = segments after /api/v1/):
 *   ["scans"]                              GET  → list accessible scans
 *   ["scans", "<id>"]                      GET  → view scan
 *   ["scans", "<id>", "trigger"]           POST → manage scan (trigger)
 *   ["scans", "<id>", "badge", "publish"]  POST → manage scan
 *   ["scans", "<id>", "findings"]          GET  → view scan
 *   ["scans", "guest"]                     POST → public (no auth)
 *   ["scan", "<id>", "trigger"]            POST → legacy alias, manage scan
 *   ["public", ...]                         *   → public (no auth)
 */
async function authorizePath(
  userId: string,
  roleGlobal: string,
  method: string,
  path: string[],
): Promise<string> {
  const [segment0, segment1, segment2, segment3] = path;

  // ── Public endpoints (no auth) ────────────────────────────────────────────
  if (segment0 === "public") return "public";
  if (segment0 === "scans" && segment1 === "guest") return "public";

  // ── Scan list (GET /scans) ────────────────────────────────────────────────
  if (segment0 === "scans" && !segment1 && method === "GET") return "list-scans";

  // ── POST /scans (create, captcha-gated) ──────────────────────────────────
  if (segment0 === "scans" && !segment1 && method === "POST") return "proxy";

  // ── Scan-level endpoints ──────────────────────────────────────────────────
  const scanId = (segment0 === "scans" || segment0 === "scan") ? segment1 : null;
  if (scanId) {
    const isTrigger =
      (segment2 === "trigger") ||
      (segment2 === "badge" && segment3 === "publish");

    if (isTrigger && method === "POST") {
      // Trigger and badge publish require manage access
      await requireScanAccess(userId, scanId, "manage");
    } else {
      // All other scan sub-resources require view access
      await requireScanAccess(userId, scanId, "view");
    }
    return "proxy";
  }

  // ── Upload flow (uploads/*) — auth is sufficient ─────────────────────────
  if (segment0 === "uploads") return "proxy";

  return "proxy";
}

// ─── Scan list with RBAC ──────────────────────────────────────────────────────

async function listAccessibleScans(userId: string, limit: number, isAdmin: boolean) {
  const scans = await prisma.scan.findMany({
    where: isAdmin ? undefined : accessibleScanWhere(userId, "view"),
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      riskLevel: true,
      riskPercent: true,
      createdAt: true,
      projectId: true,
    },
  });

  return NextResponse.json({
    items: scans.map((scan) => ({
      id: scan.id,
      status: scan.status,
      riskLevel: scan.riskLevel,
      riskPercent: scan.riskPercent,
      createdAt: scan.createdAt.toISOString(),
      projectId: scan.projectId,
    })),
  });
}

// ─── Proxy ────────────────────────────────────────────────────────────────────

async function proxy(request: NextRequest, path: string[]) {
  const url = new URL(request.url);
  const targetPath = path.map((segment) => encodeURIComponent(segment)).join("/");
  const target = `${BACKEND_BASE}/api/v1/${targetPath}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  if (INTERNAL_API_SECRET) {
    headers.set("X-ScanVul-Internal-Secret", INTERNAL_API_SECRET);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  let upstream: Response;
  try {
    upstream = await fetch(target, init);
  } catch (err) {
    console.error(`[v1-proxy] fetch failed for ${request.method} ${target}:`, err);
    return NextResponse.json({ error: "Backend unreachable" }, { status: 503 });
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, { status: upstream.status, headers: responseHeaders });
}

// ─── Error handler wrapper ────────────────────────────────────────────────────

function handleAuthError(error: unknown) {
  if (error instanceof Error && error.message === "UNAUTHORIZED") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (error instanceof Error && error.message === "USER_DISABLED") {
    return NextResponse.json({ error: "Account disabled" }, { status: 403 });
  }
  if (error instanceof Error && error.message === "FORBIDDEN") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }
  if (error instanceof Error && error.message === "BAD_PATH") {
    return NextResponse.json({ error: "Invalid API path" }, { status: 400 });
  }
  console.error("[v1-proxy] error:", error);
  return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
}

// ─── Route handlers ───────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const params = await context.params;
    const path = normalizeProxyPath(params.path);
    if (path[0] === "public") return proxy(request, path);

    const user = await requireActiveUser();
    const decision = await authorizePath(user.id, user.roleGlobal, "GET", path);

    if (decision === "list-scans") {
      const limit = Math.min(
        Number(new URL(request.url).searchParams.get("limit") ?? 20),
        100,
      );
      return listAccessibleScans(
        user.id,
        Number.isFinite(limit) ? limit : 20,
        user.roleGlobal === "admin" || user.roleGlobal === "super_admin",
      );
    }

    if (decision === "public") return proxy(request, path);
    return proxy(request, path);
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const params = await context.params;
    const path = normalizeProxyPath(params.path);

    // Public endpoints (guest scan) bypass auth entirely
    if (path[0] === "public" || (path[0] === "scans" && path[1] === "guest")) {
      return proxy(request, path);
    }

    const user = await requireActiveUser();
    await authorizePath(user.id, user.roleGlobal, "POST", path);
    return proxy(request, path);
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const params = await context.params;
    const path = normalizeProxyPath(params.path);
    const user = await requireActiveUser();
    await authorizePath(user.id, user.roleGlobal, "PUT", path);
    return proxy(request, path);
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const params = await context.params;
    const path = normalizeProxyPath(params.path);
    const user = await requireActiveUser();
    await authorizePath(user.id, user.roleGlobal, "PATCH", path);
    return proxy(request, path);
  } catch (err) {
    return handleAuthError(err);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    const params = await context.params;
    const path = normalizeProxyPath(params.path);
    const user = await requireActiveUser();
    await authorizePath(user.id, user.roleGlobal, "DELETE", path);
    return proxy(request, path);
  } catch (err) {
    return handleAuthError(err);
  }
}
