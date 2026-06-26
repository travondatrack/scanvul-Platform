import { NextRequest, NextResponse } from "next/server";

import { accessibleScanWhere, requireScanAccess } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const BACKEND_BASE = process.env.BACKEND_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? "http://127.0.0.1:8000";

async function authorizePath(userId: string, method: string, path: string[]) {
  if (path[0] === "scans" && path.length === 1 && method === "GET") {
    return "list-scans";
  }

  if (path[0] === "scans" && path[1]) {
    const scanId = path[1];
    const action = path[2] === "badge" && path[3] === "publish" ? "manage" : "view";
    await requireScanAccess(userId, scanId, action);
  }

  if (path[0] === "public") {
    return "public";
  }

  return "proxy";
}

async function listAccessibleScans(userId: string, limit: number, isAdmin: boolean) {
  const scans = await prisma.scan.findMany({
    where: isAdmin ? undefined : accessibleScanWhere(userId, "view"),
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    items: scans.map((scan) => ({
      id: scan.id,
      status: scan.status,
      riskLevel: scan.riskLevel,
      riskPercent: scan.riskPercent,
      createdAt: scan.createdAt.toISOString(),
    })),
  });
}

async function proxy(request: NextRequest, path: string[]) {
  const url = new URL(request.url);
  const target = `${BACKEND_BASE}/api/v1/${path.join("/")}${url.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(request.method)) {
    init.body = await request.arrayBuffer();
  }

  const upstream = await fetch(target, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  const body = await upstream.arrayBuffer();
  return new NextResponse(body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const user = await requireActiveUser();
  const decision = await authorizePath(user.id, "GET", path);
  if (decision === "list-scans") {
    const limit = Math.min(Number(new URL(request.url).searchParams.get("limit") ?? 20), 100);
    return listAccessibleScans(user.id, Number.isFinite(limit) ? limit : 20, user.roleGlobal === "admin");
  }
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const user = await requireActiveUser();
  await authorizePath(user.id, "POST", path);
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const user = await requireActiveUser();
  await authorizePath(user.id, "PUT", path);
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const user = await requireActiveUser();
  await authorizePath(user.id, "PATCH", path);
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const user = await requireActiveUser();
  await authorizePath(user.id, "DELETE", path);
  return proxy(request, path);
}
