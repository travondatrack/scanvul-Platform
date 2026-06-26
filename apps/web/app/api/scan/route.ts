import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/session";
import { requireProjectAccess } from "@/lib/access";

const API_BASE = process.env.BACKEND_API_BASE_URL
  ?? process.env.NEXT_PUBLIC_API_BASE_URL
  ?? "http://127.0.0.1:8000";

export async function POST(request: NextRequest) {
  try {
    const user = await requireActiveUser();
    const payload = await request.json();

    // If projectId is provided in the payload, verify the user has trigger_scan access
    if (payload?.projectId) {
      try {
        await requireProjectAccess(user.id, payload.projectId, "trigger_scan");
      } catch {
        return NextResponse.json({ error: "Project not found or access denied" }, { status: 404 });
      }
    }

    const response = await fetch(`${API_BASE}/api/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof Error && error.message === "USER_DISABLED") {
      return NextResponse.json({ error: "Account disabled" }, { status: 403 });
    }
    console.error("Scan proxy error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
