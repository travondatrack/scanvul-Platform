import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));

    const where = user.roleGlobal === "admin"
      ? undefined
      : { members: { some: { userId: user.id } } };

    const [total, organizations] = await Promise.all([
      prisma.organization.count({ where }),
      prisma.organization.findMany({
        where,
        include: {
          members: {
            where: user.roleGlobal === "admin" ? undefined : { userId: user.id },
            select: { role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    const items = organizations.map(org => ({
      ...org,
      myRole: user.roleGlobal === "admin" ? "admin" : (org.members[0]?.role ?? "viewer")
    }));

    return NextResponse.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Organization list error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      return NextResponse.json({ error: "Organization name is required" }, { status: 400 });
    }

    const baseSlug = slugify(body.slug || name);
    if (!baseSlug) {
      return NextResponse.json({ error: "Invalid organization slug" }, { status: 400 });
    }
    
    const plan = ["free", "pro", "enterprise"].includes(body.plan) ? body.plan : "free";

    const organization = await prisma.$transaction(async (tx) => {
      let slug = baseSlug;
      for (let index = 1; index < 20; index += 1) {
        const existing = await tx.organization.findUnique({ where: { slug } });
        if (!existing) break;
        slug = `${baseSlug}-${index + 1}`;
      }

      const created = await tx.organization.create({
        data: { name, slug, plan },
      });

      await tx.organizationMember.create({
        data: {
          organizationId: created.id,
          userId: user.id,
          role: "owner",
        },
      });

      return created;
    });

    return NextResponse.json(organization, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Organization creation error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
