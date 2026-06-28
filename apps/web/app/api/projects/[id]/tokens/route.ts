import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { canManageProject } from "@/lib/access";
import { logAudit } from "@/lib/audit";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id: projectId } = await params;

    const canManage = await canManageProject(user.id, projectId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const tokens = await prisma.apiToken.findMany({
      where: { projectId },
      select: {
        id: true,
        name: true,
        scopes: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json(tokens);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("GET api tokens error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id: projectId } = await params;

    const canManage = await canManageProject(user.id, projectId);
    if (!canManage) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { name } = body;
    if (!name) {
      return NextResponse.json({ error: "Token name is required" }, { status: 400 });
    }

    // Generate random token string
    const rawToken = crypto.randomBytes(32).toString("hex");
    const prefix = "sv_"; // ScanVul prefix
    const fullToken = `${prefix}${rawToken}`;

    // Hash the token
    const tokenHash = crypto.createHash("sha256").update(fullToken).digest("hex");

    const apiToken = await prisma.apiToken.create({
      data: {
        projectId,
        name,
        tokenHash,
      },
    });

    await logAudit({
      userId: user.id,
      action: "create_api_token",
      entityType: "ApiToken",
      entityId: apiToken.id,
      metadata: { projectId, name },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    return NextResponse.json({
      id: apiToken.id,
      name: apiToken.name,
      token: fullToken, // ONLY RETURNED ONCE!
      scopes: apiToken.scopes,
      createdAt: apiToken.createdAt,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("POST api tokens error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
