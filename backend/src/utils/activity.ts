import { prisma } from "../prisma";
import { sendNotificationEmail } from "./mailer";

export const createAuditLog = async (
  actorId: number,
  action: string,
  entityType: string,
  entityId?: string,
  details?: Record<string, unknown>
) => {
  const baseData = {
    action,
    actorId,
    entityId,
    entityType,
  };

  try {
    return await prisma.auditLog.create({
      data: {
        ...baseData,
        details: details || {},
      } as any,
    });
  } catch (error: any) {
    if (!String(error?.message || "").includes("details")) {
      throw error;
    }

    return prisma.auditLog.create({
      data: {
        ...baseData,
        metadata: details || {},
      } as any,
    });
  }
};

export const createNotification = async (userId: number, message: string) => {
  const notification = await prisma.notification.create({
    data: {
      message,
      userId,
    },
  });

  try {
    const user = await prisma.user.findUnique({
      select: {
        email: true,
      },
      where: {
        id: userId,
      },
    });

    if (user?.email) {
      await sendNotificationEmail(user.email, message);
    }
  } catch (error) {
    console.error("Notification email error:", error);
  }

  return notification;
};
