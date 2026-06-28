import type { Prisma, PrismaClient } from "@prisma/client";

type Tx = Prisma.TransactionClient | PrismaClient;

export async function createFindingEvent(tx: Tx, params: {
  findingId: string;
  userId?: string | null;
  eventType: string;
  comment?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}) {
  return tx.findingEvent.create({
    data: {
      findingId: params.findingId,
      userId: params.userId ?? null,
      eventType: params.eventType,
      comment: params.comment ?? null,
      oldValue: params.oldValue === undefined || params.oldValue === null ? null : String(params.oldValue),
      newValue: params.newValue === undefined || params.newValue === null ? null : String(params.newValue),
    },
  });
}

export function displayUserName(user: { name?: string | null; email?: string | null } | null | undefined) {
  return user?.name || user?.email || "A user";
}
