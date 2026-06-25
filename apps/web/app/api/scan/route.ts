import { NextRequest, NextResponse } from "next/server";

const API_BASE = process.env.BACKEND_API_BASE_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  const payload = await request.json();

  const response = await fetch(`${API_BASE}/api/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return NextResponse.json(data, { status: response.status });
}
