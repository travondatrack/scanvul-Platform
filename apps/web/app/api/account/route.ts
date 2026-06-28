import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const REQUIRED_CONFIRMATION = "DELETE";

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const image = typeof body.image === "string" ? body.image.trim().slice(0, 2000) : null;

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (image && !/^https?:\/\//i.test(image) && !image.startsWith("data:image/")) {
      return NextResponse.json({ error: "Avatar must be an image URL or data URI" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { name, image },
      select: { id: true, name: true, email: true, image: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Account update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await req.json().catch(() => ({}));

    if (body?.confirmation !== REQUIRED_CONFIRMATION) {
      return NextResponse.json(
        { error: `Type ${REQUIRED_CONFIRMATION} to confirm account deletion` },
        { status: 400 },
      );
    }

    const deletedAt = new Date();
    const anonymizedEmail = `deleted-${user.id}@deleted.local`;

    await prisma.$transaction([
      prisma.session.deleteMany({ where: { userId: user.id } }),
      prisma.account.deleteMany({ where: { userId: user.id } }),
      prisma.emailVerificationOtp.deleteMany({ where: { userId: user.id } }),
      prisma.organizationMember.deleteMany({ where: { userId: user.id } }),
      prisma.finding.updateMany({
        where: { assigneeId: user.id },
        data: { assigneeId: null },
      }),
      prisma.project.updateMany({
        where: { createdBy: user.id },
        data: { createdBy: null },
      }),
      prisma.scan.updateMany({
        where: { triggeredBy: user.id },
        data: { triggeredBy: null },
      }),
      prisma.auditEvent.updateMany({
        where: { userId: user.id },
        data: { userId: null },
      }),
      prisma.auditEvent.create({
        data: {
          userId: null,
          action: "account.deleted",
          entityType: "user",
          entityId: user.id,
          metadata: JSON.stringify({
            deletedAt: deletedAt.toISOString(),
            email: user.email,
          }),
          ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
            ?? req.headers.get("x-real-ip")
            ?? null,
        },
      }),
      prisma.user.update({
        where: { id: user.id },
        data: {
          name: "Deleted user",
          email: anonymizedEmail,
          emailVerified: null,
          image: null,
          password: null,
          roleGlobal: "user",
          status: "deleted",
        },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }

    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
