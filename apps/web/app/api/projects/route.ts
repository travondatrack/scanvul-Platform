import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { name, githubUrl } = body;

    if (!name || !githubUrl) {
      return NextResponse.json({ error: "Name and GitHub URL are required" }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        name,
        repoUrl: githubUrl,
        sourceType: "github",
        createdBy: user.id,
      },
    });

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Project creation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
