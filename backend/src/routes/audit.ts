import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";

const router = Router();

router.get("/", authenticate, requireRole("HR", "TEAM_LEAD"), async (_req: Request, res: Response) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    res.json(logs);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching audit logs" });
  }
});

export default router;
