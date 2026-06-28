import { NextRequest, NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/session";
import { grantSupportAccess, type SupportScope } from "@/lib/support-access";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireGlobalAdmin();
    const body = await req.json();
    const { organizationId, projectId, scopes, reason, durationSeconds } = body;

    const access = await grantSupportAccess({
      actorId: actor.id,
      organizationId,
      projectId,
      scopes: scopes as SupportScope[],
      reason,
      durationSeconds: Number(durationSeconds) || 3600,
    });

    return NextResponse.json(access, { status: 201 });
  } catch (error: any) {
    if (error.message?.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message?.includes("BAD_REQUEST")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Grant support access error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const actor = await requireGlobalAdmin();
    const now = new Date();

    const activeList = await prisma.adminSupportAccess.findMany({
      where: {
        actorId: actor.id,
        expiresAt: { gt: now },
        revokedAt: null,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(activeList);
  } catch (error: any) {
    if (error.message?.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
