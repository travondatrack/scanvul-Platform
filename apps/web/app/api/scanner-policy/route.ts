import { NextRequest, NextResponse } from "next/server";
import { canManageProject, canViewProject } from "@/lib/access";
import { SEVERITIES } from "@/lib/constants";
import { prisma } from "@/lib/prisma";
import { requireActiveUser } from "@/lib/session";

const ALL_ENGINES = ["semgrep", "bandit", "eslint", "owasp", "trivy", "secrets"];

function parseJsonArray(value: string | null | undefined, fallback: string[]) {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObject(value: string | null | undefined) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function serializePolicy(policy: any, projectId: string) {
  return {
    projectId,
    enabledEngines: parseJsonArray(policy?.enabledEngines, ALL_ENGINES),
    severityThreshold: policy?.severityThreshold ?? "Info",
    ruleOverrides: parseJsonObject(policy?.ruleOverrides),
    aiTriageEnabled: policy?.aiTriageEnabled ?? true,
    secretVerificationEnabled: policy?.secretVerificationEnabled ?? false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const projectId = req.nextUrl.searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    if (!(await canViewProject(user.id, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const policy = await prisma.scannerPolicy.findUnique({ where: { projectId } });
    return NextResponse.json(serializePolicy(policy, projectId));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Scanner policy get error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireActiveUser();
    const body = await req.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }
    if (!(await canManageProject(user.id, projectId))) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const enabledEngines = Array.isArray(body.enabledEngines)
      ? body.enabledEngines.filter((item: unknown) => typeof item === "string" && ALL_ENGINES.includes(item))
      : ALL_ENGINES;
    const severityThreshold = SEVERITIES.includes(body.severityThreshold) ? body.severityThreshold : "Info";

    const policy = await prisma.scannerPolicy.upsert({
      where: { projectId },
      update: {
        enabledEngines: JSON.stringify(enabledEngines),
        severityThreshold,
        ruleOverrides: JSON.stringify(body.ruleOverrides ?? {}),
        aiTriageEnabled: Boolean(body.aiTriageEnabled),
        secretVerificationEnabled: Boolean(body.secretVerificationEnabled),
      },
      create: {
        projectId,
        enabledEngines: JSON.stringify(enabledEngines),
        severityThreshold,
        ruleOverrides: JSON.stringify(body.ruleOverrides ?? {}),
        aiTriageEnabled: Boolean(body.aiTriageEnabled),
        secretVerificationEnabled: Boolean(body.secretVerificationEnabled),
      },
    });

    return NextResponse.json(serializePolicy(policy, projectId));
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Scanner policy update error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
