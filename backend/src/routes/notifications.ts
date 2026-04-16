import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.userId);
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      where: { userId },
    });

    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching notifications" });
  }
});

router.patch("/:id/read", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.userId);

    await prisma.notification.updateMany({
      data: { readAt: new Date() },
      where: {
        id: String(req.params.id),
        userId,
      },
    });

    res.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating notification" });
  }
});

export default router;
