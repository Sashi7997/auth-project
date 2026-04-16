import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth.middleware";
import { createAuditLog, createNotification } from "../utils/activity";

const router = Router();
const privilegedRoles = ["HR", "TEAM_LEAD"];

router.post("/", authenticate, async (req: Request, res: Response) => {
  try {
    const { content, type = "EXTERNAL", developerId } = req.body;
    const authorId = Number((req as any).user.userId);
    const role = (req as any).user.role;
    const developerIdNumber = Number(developerId);

    if (!content || !developerIdNumber) {
      res.status(400).json({ message: "Content and developerId are required" });
      return;
    }

    if (type === "INTERNAL" && !privilegedRoles.includes(role)) {
      res.status(403).json({ message: "Only HR and Team Lead can add internal feedback" });
      return;
    }

    if (type === "EXTERNAL" && !["SENIOR_DEV", "TEAM_LEAD", "HR"].includes(role)) {
      res.status(403).json({ message: "Only Senior Dev, Team Lead, and HR can add external feedback" });
      return;
    }

    const feedback = await prisma.feedback.create({
      data: {
        authorId,
        content,
        developerId: developerIdNumber,
        type,
      },
    });

    if (type === "EXTERNAL") {
      await createNotification(developerIdNumber, "New external feedback added");
    }

    await createAuditLog(authorId, "FEEDBACK_ADDED", "feedback", feedback.id, {
      developerId: developerIdNumber,
      type,
    });

    res.status(201).json({ message: "Feedback added", feedback });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error adding feedback" });
  }
});

router.get("/:developerId", authenticate, async (req: Request, res: Response) => {
  try {
    const developerId = Number(req.params.developerId);
    const role = (req as any).user.role;
    const userId = Number((req as any).user.userId);

    if (userId !== developerId && !privilegedRoles.includes(role)) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const feedback = await prisma.feedback.findMany({
      orderBy: { createdAt: "desc" },
      where: privilegedRoles.includes(role)
        ? { developerId }
        : {
            developerId,
            type: "EXTERNAL",
          },
    });

    res.json(feedback);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching feedback" });
  }
});

router.patch("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const { content } = req.body;
    const authorId = Number((req as any).user.userId);
    const feedback = await prisma.feedback.findUnique({ where: { id: String(req.params.id) } });

    if (!feedback || feedback.authorId !== authorId) {
      res.status(403).json({ message: "Only the author can edit feedback" });
      return;
    }

    const updatedFeedback = await prisma.feedback.update({
      data: { content },
      where: { id: feedback.id },
    });

    res.json({ message: "Feedback updated", feedback: updatedFeedback });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating feedback" });
  }
});

router.delete("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.userId);
    const role = (req as any).user.role;
    const feedback = await prisma.feedback.findUnique({ where: { id: String(req.params.id) } });

    if (!feedback) {
      res.status(404).json({ message: "Feedback not found" });
      return;
    }

    if (feedback.authorId !== userId && role !== "HR") {
      res.status(403).json({ message: "Only the author or HR can delete feedback" });
      return;
    }

    await prisma.feedback.delete({ where: { id: feedback.id } });
    res.json({ message: "Feedback deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting feedback" });
  }
});

export default router;
