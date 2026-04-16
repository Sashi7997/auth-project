import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";

export const createNotification = async (userId: number, message: string) => {
  await prisma.notification.create({
    data: {
      message,
      userId,
    },
  });
};

export const createAuditLog = async (
  actorId: number | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details: Prisma.InputJsonObject
) => {
  await prisma.auditLog.create({
    data: {
      action,
      actorId,
      details,
      entityId,
      entityType,
    },
  });
};
