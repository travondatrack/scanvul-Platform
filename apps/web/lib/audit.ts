import { prisma } from "./prisma";

export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}) {
  try {
    await prisma.auditEvent.create({
      data: {
        userId: params.userId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
        ipAddress: params.ipAddress,
      },
    });
  } catch (error) {
    console.error("[Audit Log Failed]", error);
  }
}
