import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const BACKEND_BASE = process.env.BACKEND_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { projectId, repoUrl } = body;

    if (!projectId || !repoUrl) {
      return NextResponse.json({ error: "Project ID and Repo URL are required" }, { status: 400 });
    }

    // Ensure the project belongs to the user
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.createdBy !== user.id) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const scan = await prisma.scan.create({
      data: {
        projectId,
        triggeredBy: user.id,
        sourceType: "repo_url",
        sourceValue: repoUrl,
        status: "queued",
      }
    });

    try {
      const pyRes = await fetch(`${BACKEND_BASE}/api/v1/scan/${scan.id}/trigger`, {
        method: "POST"
      });
      
      if (!pyRes.ok) {
        throw new Error(`Python API returned ${pyRes.status}`);
      }
    } catch (fetchError) {
      console.error("Failed to trigger Python worker:", fetchError);
      
      // Update scan to failed so it doesn't get stuck in queued forever
      await prisma.scan.update({
        where: { id: scan.id },
        data: { status: "failed" }
      });
      
      return NextResponse.json({ error: "Failed to trigger scan engine. Ensure Python backend is running." }, { status: 500 });
    }

    return NextResponse.json(scan, { status: 201 });
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
