import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postBackend, BackendError } from "@/lib/backend";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "").trim();
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const apiToken = await prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { project: true },
    });

    if (!apiToken || apiToken.isActive !== "true") {
      return NextResponse.json({ error: "Invalid or revoked token" }, { status: 401 });
    }

    if (!apiToken.scopes.includes("scan:create")) {
      return NextResponse.json({ error: "Token missing scan:create scope" }, { status: 403 });
    }

    const body = await req.json();
    const { sourceType = "repo_url", sourceValue } = body;

    if (!["repo_url", "archive", "paste"].includes(sourceType)) {
      return NextResponse.json({ error: "Invalid sourceType" }, { status: 400 });
    }

    const resolvedSourceValue = sourceValue || apiToken.project.repoUrl;

    if (!resolvedSourceValue) {
      return NextResponse.json({ error: "sourceValue or project repoUrl is required" }, { status: 400 });
    }

    // Update last used at
    await prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    });

    // Create scan
    const scan = await prisma.scan.create({
      data: {
        projectId: apiToken.projectId,
        sourceType,
        sourceValue: resolvedSourceValue,
        status: "queued",
        triggeredBy: "ci_pipeline", // Special marker or token ID
        scanEvents: {
          create: {
            eventType: "queued",
            message: "CI scan queued and waiting for worker pickup.",
          },
        },
      },
    });

    // Trigger backend
    try {
      await postBackend(`scans/${scan.id}/trigger`, undefined, { timeoutMs: 10000 });
    } catch (backendErr) {
      console.error("[trigger] Backend trigger failed for scan", scan.id, backendErr);
      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "failed", errorMessage: "Failed to start scan engine." },
      });
      return NextResponse.json({ error: "Failed to start scan engine" }, { status: 503 });
    }

    return NextResponse.json({
      scanId: scan.id,
      projectId: scan.projectId,
      status: scan.status,
    }, { status: 201 });
  } catch (error) {
    console.error("CI scan trigger error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
