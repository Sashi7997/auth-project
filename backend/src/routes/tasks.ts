import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { createAuditLog, createNotification } from "../utils/activity";

const router = Router();
const privilegedRoles = ["HR", "TEAM_LEAD"];

const canDeveloperTransition = (oldStatus: string, newStatus: string) =>
  (oldStatus === "ASSIGNED" && newStatus === "IN_PROGRESS") ||
  (oldStatus === "IN_PROGRESS" && newStatus === "SUBMITTED") ||
  (oldStatus === "NEEDS_REVISION" && ["IN_PROGRESS", "SUBMITTED"].includes(newStatus));

const canReviewerTransition = (oldStatus: string, newStatus: string) =>
  (oldStatus === "SUBMITTED" && ["REVIEWED", "NEEDS_REVISION"].includes(newStatus)) ||
  (oldStatus === "REVIEWED" && ["COMPLETED", "NEEDS_REVISION"].includes(newStatus)) ||
  (oldStatus === "ASSIGNED" && newStatus === "IN_PROGRESS") ||
  (oldStatus === "IN_PROGRESS" && newStatus === "SUBMITTED");

router.post("/assign", authenticate, requireRole("HR", "TEAM_LEAD"), async (req: Request, res: Response) => {
  try {
    const { title, description, assignedTo, dueDate, priority = "MEDIUM", attachments = [] } = req.body;
    const assignedBy = Number((req as any).user.userId);
    const assignedToId = Number(assignedTo);
    const attachmentList = Array.isArray(attachments) ? attachments : String(attachments).split(",").map((item) => item.trim()).filter(Boolean);

    if (!title || !assignedToId) {
      res.status(400).json({ message: "Title and assignedTo are required" });
      return;
    }

    const task = await prisma.task.create({
      data: {
        assignedById: assignedBy,
        assignedToId,
        attachments: attachmentList,
        description: description || "",
        dueDate: dueDate ? new Date(dueDate) : undefined,
        priority,
        status: "ASSIGNED",
        title,
      },
    });

    await createNotification(assignedToId, `New task assigned: ${title}`);
    await createAuditLog(assignedBy, "TASK_ASSIGNED", "tasks", task.id, { assignedTo: assignedToId, title });

    res.status(201).json({ message: "Task assigned successfully", task });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error assigning task" });
  }
});

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.userId);
    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      where: { assignedToId: userId },
    });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching tasks" });
  }
});

router.get("/:developerId", authenticate, async (req: Request, res: Response) => {
  try {
    const requester = (req as any).user;
    const developerId = Number(req.params.developerId);

    if (Number(requester.userId) !== developerId && !privilegedRoles.includes(requester.role)) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const tasks = await prisma.task.findMany({
      orderBy: { createdAt: "desc" },
      where: { assignedToId: developerId },
    });

    res.json(tasks);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching tasks" });
  }
});

router.patch("/:id/status", authenticate, async (req: Request, res: Response) => {
  try {
    const requester = (req as any).user;
    const taskId = String(req.params.id);
    const { attachments = [], status } = req.body;
    const task = await prisma.task.findUnique({
      include: {
        assignedTo: {
          select: {
            email: true,
            id: true,
            name: true,
          },
        },
      },
      where: { id: taskId },
    });

    if (!task) {
      res.status(404).json({ message: "Task not found" });
      return;
    }

    const isPrivileged = privilegedRoles.includes(requester.role);
    const isOwner = task.assignedToId === Number(requester.userId);

    if (!isPrivileged && !isOwner) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    if (!isPrivileged && !canDeveloperTransition(task.status, status)) {
      res.status(403).json({ message: "Invalid task status transition for developer" });
      return;
    }

    if (isPrivileged && !canReviewerTransition(task.status, status) && task.status !== status) {
      res.status(400).json({ message: "Invalid reviewer task status transition" });
      return;
    }

    const attachmentList = Array.isArray(attachments)
      ? attachments.map((item) => String(item).trim()).filter(Boolean)
      : String(attachments).split(",").map((item) => item.trim()).filter(Boolean);

    const updatedTask = await prisma.task.update({
      data: {
        attachments: attachmentList.length ? [...task.attachments, ...attachmentList] : task.attachments,
        status,
      },
      where: { id: taskId },
    });

    if (status === "SUBMITTED") {
      const reviewers = await prisma.user.findMany({
        select: { id: true },
        where: {
          role: { in: ["HR", "TEAM_LEAD"] },
        },
      });

      const developerLabel = task.assignedTo?.name || task.assignedTo?.email || `User ${task.assignedToId}`;

      await Promise.all(
        reviewers.map((reviewer) =>
          createNotification(
            reviewer.id,
            `Task submitted for review | developerId:${task.assignedToId} | developer:${developerLabel} | title:${task.title}`
          )
        )
      );
    }

    if (["NEEDS_REVISION", "COMPLETED"].includes(status)) {
      await createNotification(task.assignedToId, `Task "${task.title}" marked ${status}`);
    }

    await createAuditLog(Number(requester.userId), "TASK_STATUS_CHANGED", "tasks", taskId, {
      newStatus: status,
      oldStatus: task.status,
    });

    res.json({ message: "Task updated", task: updatedTask });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating task" });
  }
});

router.delete("/:id", authenticate, requireRole("HR", "TEAM_LEAD"), async (req: Request, res: Response) => {
  try {
    await prisma.task.delete({ where: { id: String(req.params.id) } });
    res.json({ message: "Task deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting task" });
  }
});

export default router;
