import { prisma } from "@/lib/prisma";

export type OrganizationRole = "owner" | "admin" | "member" | "viewer";
export type ProjectAction = "view" | "manage" | "trigger_scan";

const VIEW_ROLES: OrganizationRole[] = ["owner", "admin", "member", "viewer"];
const MANAGE_ROLES: OrganizationRole[] = ["owner", "admin"];
const TRIGGER_ROLES: OrganizationRole[] = ["owner", "admin", "member"];

async function isGlobalAdmin(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { roleGlobal: true, status: true },
  });

  return user?.status === "active" && user.roleGlobal === "admin";
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
  
  if (user.roleGlobal === "admin") {
    if (scopeId !== undefined) {
      return { organizationId: scopeId };
    }
    return undefined; // All projects for admin if no scope
  }
  
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
  
  if (user.roleGlobal === "admin") {
    if (scopeId !== undefined) {
      return { project: { organizationId: scopeId } };
    }
    return undefined;
  }
  
  return accessibleScanWhere(user.id, action, scopeId);
}

export async function canViewProject(userId: string, projectId: string) {
  if (await isGlobalAdmin(userId)) return true;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectWhere(userId, "view") },
    select: { id: true },
  });
  return Boolean(project);
}

export async function canManageProject(userId: string, projectId: string) {
  if (await isGlobalAdmin(userId)) return true;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectWhere(userId, "manage") },
    select: { id: true },
  });
  return Boolean(project);
}

export async function canTriggerScan(userId: string, projectId: string) {
  if (await isGlobalAdmin(userId)) return true;
  const project = await prisma.project.findFirst({
    where: { id: projectId, ...accessibleProjectWhere(userId, "trigger_scan") },
    select: { id: true },
  });
  return Boolean(project);
}

export async function canViewScan(userId: string, scanId: string) {
  if (await isGlobalAdmin(userId)) return true;
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, ...accessibleScanWhere(userId, "view") },
    select: { id: true },
  });
  return Boolean(scan);
}

export async function canManageScan(userId: string, scanId: string) {
  if (await isGlobalAdmin(userId)) return true;
  const scan = await prisma.scan.findFirst({
    where: { id: scanId, ...accessibleScanWhere(userId, "manage") },
    select: { id: true },
  });
  return Boolean(scan);
}

export async function canManageFinding(userId: string, findingId: string) {
  if (await isGlobalAdmin(userId)) return true;
  const finding = await prisma.finding.findFirst({
    where: {
      id: findingId,
      scan: accessibleScanWhere(userId, "manage"),
    },
    select: { id: true },
  });
  return Boolean(finding);
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
