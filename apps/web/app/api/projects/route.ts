import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { accessibleProjectWhere } from "@/lib/access";

export async function GET() {
  try {
    const user = await requireActiveUser();
    const projects = await prisma.project.findMany({
      where: user.roleGlobal === "admin" ? undefined : accessibleProjectWhere(user.id, "view"),
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        scans: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ items: projects });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Project list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const { name, githubUrl, organizationId } = body;

    if (!name || !githubUrl) {
      return NextResponse.json({ error: "Name and GitHub URL are required" }, { status: 400 });
    }

    if (organizationId) {
      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: user.id,
          role: { in: ["owner", "admin"] },
        },
        select: { id: true },
      });

      if (!membership && user.roleGlobal !== "admin") {
        return NextResponse.json({ error: "Organization access denied" }, { status: 403 });
      }
    }

    const project = await prisma.project.create({
      data: {
        name,
        repoUrl: githubUrl,
        sourceType: "github",
        createdBy: user.id,
        organizationId: organizationId || null,
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
