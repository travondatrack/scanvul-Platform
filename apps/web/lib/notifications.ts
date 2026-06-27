import { prisma } from "@/lib/prisma";

export type NotificationPayload = Record<string, unknown>;

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  payload?: NotificationPayload;
}) {
  return prisma.notification.create({
    data: {
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      payload: params.payload ? JSON.stringify(params.payload) : null,
    },
  });
}

export async function createNotifications(items: Array<{
  userId: string;
  type: string;
  title: string;
  message: string;
  payload?: NotificationPayload;
}>) {
  if (items.length === 0) {
    return { count: 0 };
  }

  return prisma.notification.createMany({
    data: items.map((item) => ({
      userId: item.userId,
      type: item.type,
      title: item.title,
      message: item.message,
      payload: item.payload ? JSON.stringify(item.payload) : null,
    })),
  });
}

export function parseNotificationPayload(payload: string | null) {
  if (!payload) {
    return {};
  }

  try {
    return JSON.parse(payload) as NotificationPayload;
  } catch {
    return {};
  }
}
