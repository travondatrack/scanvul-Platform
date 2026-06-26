import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash },
    });

    if (!apiToken || apiToken.isActive !== "true") {
      return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
    }

    const { id } = await params;

    const scan = await prisma.scan.findFirst({
      where: {
        id,
        projectId: apiToken.projectId,
      },
      select: {
        id: true,
        status: true,
        riskLevel: true,
        errorMessage: true,
      },
    });

    if (!scan) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    return NextResponse.json(scan);
  } catch (error) {
    console.error("CI scan status error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
