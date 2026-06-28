import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";
import { requireProjectAccess, canManageProject } from "@/lib/access";
import { NOTIFICATION_TYPES } from "@/lib/constants";
import { createNotifications } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    try {
      await requireProjectAccess(user.id, id, "view");
    } catch {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true, slug: true } },
        scans: {
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            status: true,
            riskLevel: true,
            riskPercent: true,
            sourceType: true,
            sourceValue: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        _count: { select: { findings: true, scans: true } },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Project detail error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    if (!(await canManageProject(user.id, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const body = await req.json();
    const allowed = ["name", "description", "visibility", "status", "defaultBranch"] as const;
    const data: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) data[key] = body[key];
    }

    const project = await prisma.project.update({ where: { id }, data });
    return NextResponse.json(project);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Project update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    if (!(await canManageProject(user.id, id))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        createdBy: true,
        organization: {
          select: { members: { select: { userId: true } } },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    await prisma.project.delete({ where: { id } });

    const recipients = new Set<string>();
    if (project.createdBy) recipients.add(project.createdBy);
    project.organization?.members.forEach((member) => recipients.add(member.userId));
    recipients.delete(user.id);
    await createNotifications(Array.from(recipients).map((userId) => ({
      userId,
      type: NOTIFICATION_TYPES.projectDeleted,
      title: "Project deleted",
      message: `${project.name} was deleted.`,
      payload: { projectId: project.id, projectName: project.name, deletedBy: user.id },
    })));

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Project delete error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
