import { NextRequest, NextResponse } from "next/server";
import { canManageFinding } from "@/lib/access";
import { createAuditEvent } from "@/lib/audit";
import { maskSecret } from "@/lib/exporters/utils";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const MAX_SNIPPET_CHARS = 4000;

function extractJson(text: string) {
  const trimmed = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(trimmed);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;
    if (!(await canManageFinding(user.id, id))) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }
    return NextResponse.json({
      available: Boolean(process.env.LLM_API_KEY),
      reason: process.env.LLM_API_KEY ? null : "AI API key is not configured.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireActiveUser();
    const { id } = await params;

    const finding = await prisma.finding.findUnique({
      where: { id },
      include: {
        scan: { select: { id: true, projectId: true } },
      },
    });

    if (!finding || !(await canManageFinding(user.id, id))) {
      return NextResponse.json({ error: "Finding not found" }, { status: 404 });
    }

    const apiKey = process.env.LLM_API_KEY;
    const baseUrl = (process.env.LLM_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
    const model = process.env.LLM_MODEL || "gpt-4o-mini";

    if (!apiKey) {
      return NextResponse.json({ error: "AI API key is not configured" }, { status: 409 });
    }

    let review: Record<string, unknown>;
    {
      const snippet = maskSecret(finding.codeSnippet || finding.evidence || "").slice(0, MAX_SNIPPET_CHARS);
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          max_tokens: 700,
          messages: [
            {
              role: "system",
              content: "You are an application security reviewer. Return only valid JSON with keys isLikelyTruePositive, confidence, explanation, suggestedFix, secureCodeExample, pentestSuggestion.",
            },
            {
              role: "user",
              content: JSON.stringify({
                title: finding.title,
                vulnType: finding.vulnType,
                severity: finding.severity,
                confidence: finding.confidence,
                cweId: finding.cweId,
                owaspCategory: finding.owaspCategory,
                filePath: finding.filePath,
                lineStart: finding.lineStart,
                lineEnd: finding.lineEnd,
                source: finding.source,
                sink: finding.sink,
                evidence: maskSecret(finding.evidence || ""),
                codeSnippet: snippet,
              }),
            },
          ],
        }),
      });

      if (!response.ok) {
        return NextResponse.json({ error: "AI review provider failed" }, { status: 502 });
      }
      const data = await response.json();
      review = extractJson(data?.choices?.[0]?.message?.content || "{}");
    }

    const event = await prisma.$transaction(async (tx) => {
      const created = await tx.findingEvent.create({
        data: {
          findingId: finding.id,
          userId: user.id,
          eventType: "ai_review",
          comment: JSON.stringify(review),
        },
      });
      await createAuditEvent(tx, {
        userId: user.id,
        action: "finding.ai_review",
        entityType: "Finding",
        entityId: finding.id,
        metadata: { scanId: finding.scanId, projectId: finding.projectId },
        ipAddress: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip"),
      });
      return created;
    });

    return NextResponse.json({ review, event }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("AI finding review error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
