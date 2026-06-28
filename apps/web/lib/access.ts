import { prisma } from "@/lib/prisma";

export type OrganizationRole = "owner" | "admin" | "member" | "viewer";
export type ProjectAction = "view" | "manage" | "trigger_scan";

const VIEW_ROLES: OrganizationRole[] = ["owner", "admin", "member", "viewer"];
const MANAGE_ROLES: OrganizationRole[] = ["owner", "admin"];
const TRIGGER_ROLES: OrganizationRole[] = ["owner", "admin", "member"];

export type SupportScope = "view_metadata" | "view_findings" | "view_source" | "manage_scan" | "manage_policy";

export async function isGlobalAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleGlobal: true, status: true },
  });

  return user?.status === "active" && (user.roleGlobal === "admin" || user.roleGlobal === "super_admin");
}

export async function isSuperAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleGlobal: true, status: true },
  });

  return user?.status === "active" && user.roleGlobal === "super_admin";
}

export async function getActiveSupportAccess(actorId: string, target: { projectId?: string; organizationId?: string }) {
  if (!(await isGlobalAdmin(actorId))) return null;
  if (!target.projectId && !target.organizationId) return null;

  const now = new Date();
  const accessList = await prisma.adminSupportAccess.findMany({
    where: {
      actorId,
      expiresAt: { gt: now },
      revokedAt: null,
      OR: [
        target.projectId ? { projectId: target.projectId } : undefined,
        target.organizationId ? { organizationId: target.organizationId } : undefined,
      ].filter(Boolean) as any,
    },
  });

  return accessList.length > 0 ? accessList : null;
}

export async function hasSupportAccessScope(
  actorId: string,
  target: { projectId?: string; organizationId?: string },
  requiredScope: SupportScope
): Promise<boolean> {
  const accessList = await getActiveSupportAccess(actorId, target);
  if (!accessList) return false;

  for (const acc of accessList) {
    try {
      const scopes: string[] = JSON.parse(acc.scopes);
      if (Array.isArray(scopes) && (scopes.includes(requiredScope) || scopes.includes("all"))) {
        return true;
      }
    } catch {
      if (acc.scopes.split(",").map((s) => s.trim()).includes(requiredScope)) {
        return true;
      }
    }
  }

  return false;
}

function rolesFor(action: ProjectAction) {
  if (action === "manage") return MANAGE_ROLES;
  if (action === "trigger_scan") return TRIGGER_ROLES;
  return VIEW_ROLES;
}

export function accessibleProjectWhere(
  userId: string, 
  action: ProjectAction = "view",
  orgScope?: string | null
) {
  const roles = rolesFor(action);

  const baseOr = [
    { createdBy: userId },
    {
      organization: {
        members: {
          some: {
            userId,
            role: { in: roles },
          },
        },
      },
    },
    action === "view" ? { visibility: "public" } : undefined,
  ].filter(Boolean) as any;

  const where: any = { OR: baseOr };

  if (orgScope === null) {
    where.organizationId = null;
  } else if (orgScope !== undefined) {
    where.organizationId = orgScope;
  }

  return where;
}

export function projectScopeWhere(
  user: { id: string, roleGlobal: string },
  action: ProjectAction,
  orgCtx?: { type: string, id?: string }
) {
  const scopeId = orgCtx?.type === "personal" ? null : (orgCtx?.id ?? undefined);
  return accessibleProjectWhere(user.id, action, scopeId);
}

export function accessibleScanWhere(
  userId: string,
  action: ProjectAction = "view",
  orgScope?: string | null
) {
  return {
    project: accessibleProjectWhere(userId, action, orgScope),
  };
}

export function scanScopeWhere(
  user: { id: string, roleGlobal: string },
  action: ProjectAction,
  orgCtx?: { type: string, id?: string }
) {
  const scopeId = orgCtx?.type === "personal" ? null : (orgCtx?.id ?? undefined);
  return accessibleScanWhere(user.id, action, scopeId);
}

export async function canViewProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectWhere(userId, "view") },
    select: { id: true, organizationId: true },
  });
  if (project) return true;

  if (await isGlobalAdmin(userId)) {
    const target = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (target) {
      return (
        (await hasSupportAccessScope(userId, { projectId, organizationId: target.organizationId ?? undefined }, "view_findings")) ||
        (await hasSupportAccessScope(userId, { projectId, organizationId: target.organizationId ?? undefined }, "view_metadata")) ||
        (await hasSupportAccessScope(userId, { projectId, organizationId: target.organizationId ?? undefined }, "view_source"))
      );
    }
  }
  return false;
}

export async function canManageProject(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectWhere(userId, "manage") },
    select: { id: true, organizationId: true },
  });
  if (project) return true;

  if (await isGlobalAdmin(userId)) {
    const target = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (target) {
      return await hasSupportAccessScope(userId, { projectId, organizationId: target.organizationId ?? undefined }, "manage_policy");
    }
  }
  return false;
}

export async function canTriggerScan(userId: string, projectId: string) {
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectWhere(userId, "trigger_scan") },
    select: { id: true, organizationId: true },
  });
  if (project) return true;

  if (await isGlobalAdmin(userId)) {
    const target = await prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (target) {
      return await hasSupportAccessScope(userId, { projectId, organizationId: target.organizationId ?? undefined }, "manage_scan");
    }
  }
  return false;
}

export async function canViewScan(userId: string, scanId: string) {
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, ...accessibleScanWhere(userId, "view") },
    select: { id: true, projectId: true },
  });
  if (scan) return true;

  if (await isGlobalAdmin(userId)) {
    const targetScan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { projectId: true, project: { select: { organizationId: true } } },
    });
    if (targetScan && targetScan.projectId) {
      return (
        (await hasSupportAccessScope(userId, { projectId: targetScan.projectId, organizationId: targetScan.project?.organizationId ?? undefined }, "view_findings")) ||
        (await hasSupportAccessScope(userId, { projectId: targetScan.projectId, organizationId: targetScan.project?.organizationId ?? undefined }, "view_metadata")) ||
        (await hasSupportAccessScope(userId, { projectId: targetScan.projectId, organizationId: targetScan.project?.organizationId ?? undefined }, "view_source"))
      );
    }
  }
  return false;
}

export async function canManageScan(userId: string, scanId: string) {
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, ...accessibleScanWhere(userId, "manage") },
    select: { id: true, projectId: true },
  });
  if (scan) return true;

  if (await isGlobalAdmin(userId)) {
    const targetScan = await prisma.scan.findUnique({
      where: { id: scanId },
      select: { projectId: true, project: { select: { organizationId: true } } },
    });
    if (targetScan && targetScan.projectId) {
      return await hasSupportAccessScope(userId, { projectId: targetScan.projectId, organizationId: targetScan.project?.organizationId ?? undefined }, "manage_scan");
    }
  }
  return false;
}

export async function canManageFinding(userId: string, findingId: string) {
  const finding = await prisma.finding.findFirst({
    where: {
      id: findingId,
      scan: accessibleScanWhere(userId, "manage"),
    },
    select: { id: true },
  });
  if (finding) return true;

  if (await isGlobalAdmin(userId)) {
    const targetFinding = await prisma.finding.findUnique({
      where: { id: findingId },
      select: { projectId: true, project: { select: { organizationId: true } } },
    });
    if (targetFinding && targetFinding.projectId) {
      return await hasSupportAccessScope(userId, { projectId: targetFinding.projectId, organizationId: targetFinding.project?.organizationId ?? undefined }, "manage_policy");
    }
  }
  return false;
}

export async function getEligibleProjectAssignees(projectId: string) {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      createdBy: true,
      organizationId: true,
      organization: {
        select: {
          members: {
            select: {
              user: { select: { id: true, name: true, email: true, image: true, status: true } },
              role: true,
            },
          },
        },
      },
      user: { select: { id: true, name: true, email: true, image: true, status: true } },
    },
  });

  if (!project) return [];

  if (project.organizationId) {
    return project.organization?.members
      .filter((member) => member.user.status === "active")
      .map((member) => ({ ...member.user, role: member.role })) ?? [];
  }

  return project.user && project.user.status === "active"
    ? [{ ...project.user, role: "owner" }]
    : [];
}

export async function isEligibleProjectAssignee(projectId: string, assigneeId: string) {
  const assignees = await getEligibleProjectAssignees(projectId);
  return assignees.some((assignee) => assignee.id === assigneeId);
}

export async function requireProjectAccess(
  userId: string,
  projectId: string,
  action: ProjectAction = "view",
) {
  const allowed =
    action === "manage"
      ? await canManageProject(userId, projectId)
      : action === "trigger_scan"
        ? await canTriggerScan(userId, projectId)
        : await canViewProject(userId, projectId);

  if (!allowed) {
    throw new Error("FORBIDDEN");
  }
}

export async function requireScanAccess(
  userId: string,
  scanId: string,
  action: Extract<ProjectAction, "view" | "manage"> = "view",
) {
  const allowed =
    action === "manage"
      ? await canManageScan(userId, scanId)
      : await canViewScan(userId, scanId);

  if (!allowed) {
    throw new Error("FORBIDDEN");
  }
}
