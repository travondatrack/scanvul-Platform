import { prisma } from "@/lib/prisma";
import { isSuperAdmin, isGlobalAdmin, type SupportScope, getActiveSupportAccess, hasSupportAccessScope } from "@/lib/access";
import { logAudit } from "@/lib/audit";

export { type SupportScope, getActiveSupportAccess, hasSupportAccessScope };

export async function grantSupportAccess(params: {
  actorId: string;
  organizationId?: string;
  projectId?: string;
  scopes: SupportScope[];
  reason: string;
  durationSeconds: number;
}) {
  const superAdmin = await isSuperAdmin(params.actorId);
  if (!superAdmin) {
    throw new Error("FORBIDDEN: Only super_admin can grant support access");
  }

  if (!params.reason || params.reason.trim().length < 5) {
    throw new Error("BAD_REQUEST: Valid reason required for break-glass access");
  }

  if (!params.organizationId && !params.projectId) {
    throw new Error("BAD_REQUEST: Target organizationId or projectId required");
  }

  const expiresAt = new Date(Date.now() + params.durationSeconds * 1000);

  const access = await prisma.adminSupportAccess.create({
    data: {
      actorId: params.actorId,
      organizationId: params.organizationId ?? null,
      projectId: params.projectId ?? null,
      scopes: JSON.stringify(params.scopes),
      reason: params.reason,
      expiresAt,
    },
  });

  await logAudit({
    userId: params.actorId,
    action: "ADMIN_SUPPORT_ACCESS_GRANTED",
    entityType: params.projectId ? "Project" : "Organization",
    entityId: params.projectId || params.organizationId,
    metadata: {
      accessId: access.id,
      scopes: params.scopes,
      reason: params.reason,
      expiresAt: expiresAt.toISOString(),
    },
  });

  return access;
}

export async function revokeSupportAccess(actorId: string, accessId: string) {
  const superAdmin = await isSuperAdmin(actorId);
  if (!superAdmin) {
    throw new Error("FORBIDDEN: Only super_admin can revoke support access");
  }

  const access = await prisma.adminSupportAccess.update({
    where: { id: accessId },
    data: { revokedAt: new Date() },
  });

  await logAudit({
    userId: actorId,
    action: "ADMIN_SUPPORT_ACCESS_REVOKED",
    entityType: access.projectId ? "Project" : "Organization",
    entityId: access.projectId || access.organizationId || undefined,
    metadata: { accessId },
  });

  return access;
}
