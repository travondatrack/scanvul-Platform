import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { requireProjectAccess } from "@/lib/access";
import { BackendError, postBackend } from "@/lib/backend";
import { logAudit } from "@/lib/audit";

const VALID_SOURCE_TYPES = new Set(["repo_url", "archive", "paste"]);

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { projectId, repoUrl, sourceType = "repo_url", sourceValue } = body;

    // ── Input validation ───────────────────────────────────────────────────
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const resolvedSourceType = VALID_SOURCE_TYPES.has(sourceType) ? sourceType : "repo_url";
    const resolvedSourceValue = sourceValue ?? repoUrl;

    if (!resolvedSourceValue) {
      return NextResponse.json({ error: "sourceValue or repoUrl is required" }, { status: 400 });
    }

    // ── Project access check ────────────────────────────────────────────────
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, repoUrl: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    try {
      await requireProjectAccess(user.id, projectId, "trigger_scan");
    } catch {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    // ── Idempotency: prevent duplicate trigger on already-running scan ──────
    const runningScan = await prisma.scan.findFirst({
      where: { projectId, status: "running" },
      select: { id: true },
    });

    if (runningScan) {
      return NextResponse.json(
        {
          error: "A scan is already running for this project. Wait for it to complete before triggering a new one.",
          scanId: runningScan.id,
        },
        { status: 409 },
      );
    }

    // ── Create Scan record in Prisma (MySQL) ────────────────────────────────
    const scan = await prisma.scan.create({
      data: {
        projectId,
        triggeredBy: user.id,
        sourceType: resolvedSourceType,
        sourceValue: resolvedSourceValue,
        status: "queued",
      },
    });

    await logAudit({
      userId: user.id,
      action: "trigger_scan",
      entityType: "Scan",
      entityId: scan.id,
      metadata: { projectId, sourceType: resolvedSourceType },
      ipAddress: req.headers.get("x-forwarded-for") || undefined,
    });

    // ── Trigger FastAPI worker ──────────────────────────────────────────────
    // Uses canonical plural URL: /api/v1/scans/{scan_id}/trigger
    try {
      await postBackend(`scans/${scan.id}/trigger`, undefined, { timeoutMs: 10000 });
    } catch (backendErr) {
      console.error("[trigger] Backend trigger failed for scan", scan.id, backendErr);

      // Mark scan as failed immediately — prevents zombie queued scans
      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "failed" },
      });

      const message =
        backendErr instanceof BackendError && backendErr.status === 409
          ? "Scan engine reports this scan is already running."
          : "Failed to start scan engine. Ensure the Python backend is running.";

      return NextResponse.json({ error: message }, { status: 503 });
    }

    return NextResponse.json(
      {
        id: scan.id,
        projectId: scan.projectId,
        status: scan.status,
        sourceType: scan.sourceType,
        createdAt: scan.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Scan trigger error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
