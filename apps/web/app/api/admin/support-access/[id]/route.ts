import { NextRequest, NextResponse } from "next/server";
import { requireGlobalAdmin } from "@/lib/session";
import { revokeSupportAccess } from "@/lib/support-access";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireGlobalAdmin();
    const resolvedParams = await Promise.resolve(params);
    const accessId = resolvedParams.id;

    const revoked = await revokeSupportAccess(actor.id, accessId);
    return NextResponse.json(revoked);
  } catch (error: any) {
    if (error.message?.includes("UNAUTHORIZED")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message?.includes("FORBIDDEN")) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error("Revoke support access error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
