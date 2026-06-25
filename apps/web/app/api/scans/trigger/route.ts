import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../../../lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !(session.user as any).id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = (session.user as any).id;
    const body = await req.json();
    const { projectId, repoUrl } = body;

    if (!projectId || !repoUrl) {
      return NextResponse.json({ error: "Project ID and Repo URL are required" }, { status: 400 });
    }

    // Ensure the project belongs to the user
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.createdBy !== userId) {
      return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
    }

    const scan = await prisma.scan.create({
      data: {
        projectId,
        triggeredBy: userId,
        sourceType: "repo_url",
        sourceValue: repoUrl,
        status: "queued",
      }
    });

    try {
      const pyRes = await fetch(`http://127.0.0.1:8001/api/v1/scan/${scan.id}/trigger`, {
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
    console.error("Scan trigger error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
