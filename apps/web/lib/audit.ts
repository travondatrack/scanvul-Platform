import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function logAudit(params: {
  userId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
}) {
  try {
    await createAuditEvent(prisma, params);
  } catch (error) {
    console.error("[Audit Log Failed]", error);
  }
}

export async function createAuditEvent(tx: Tx, params: {
  userId?: string | null;
  action: string;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, any>;
  ipAddress?: string | null;
}) {
  return tx.auditEvent.create({
    data: {
      userId: params.userId,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      ipAddress: params.ipAddress,
    },
  });
}
