import { Router, Request, Response } from "express";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { createAuditLog, createNotification } from "../utils/activity";

const router = Router();
const canManageProfiles = (role: string) => role === "HR" || role === "TEAM_LEAD";

const publicProfileSelect = {
  department: true,
  email: true,
  githubUrl: true,
  id: true,
  inviteExpiresAt: true,
  joinDate: true,
  linkedinUrl: true,
  name: true,
  photoUrl: true,
  role: true,
  skills: true,
  trainingEndDate: true,
  trainingStartDate: true,
  trainingStatus: true,
};

const managerProfileSelect = {
  ...publicProfileSelect,
  internalNotes: true,
};

router.get("/all", authenticate, requireRole("HR", "TEAM_LEAD"), async (_req: Request, res: Response) => {
  try {
    const profiles = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: managerProfileSelect,
    });

    res.json(profiles);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching profiles" });
  }
});

router.get("/", authenticate, async (req: Request, res: Response) => {
  try {
    const requester = (req as any).user;
    const profile = await prisma.user.findUnique({
      select: canManageProfiles(requester.role) ? managerProfileSelect : publicProfileSelect,
      where: { id: Number(requester.userId) },
    });

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

router.get("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const requester = (req as any).user;
    const profileId = Number(req.params.id);

    if (Number(requester.userId) !== profileId && !canManageProfiles(requester.role)) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    const profile = await prisma.user.findUnique({
      select: canManageProfiles(requester.role) ? managerProfileSelect : publicProfileSelect,
      where: { id: profileId },
    });

    if (!profile) {
      res.status(404).json({ message: "Profile not found" });
      return;
    }

    res.json(profile);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

router.patch("/", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.userId);
    const { name, skills, photoUrl, githubUrl, linkedinUrl } = req.body;

    await prisma.user.update({
      data: {
        githubUrl,
        linkedinUrl,
        name,
        photoUrl,
        skills: Array.isArray(skills) ? skills : undefined,
      },
      where: { id: userId },
    });

    await createAuditLog(userId, "PROFILE_UPDATED", "users", String(userId), {
      fields: ["name", "skills", "photoUrl", "githubUrl", "linkedinUrl"],
    });

    res.json({ message: "Profile updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating profile" });
  }
});

router.patch("/:id", authenticate, async (req: Request, res: Response) => {
  try {
    const requester = (req as any).user;
    const profileId = Number(req.params.id);
    const {
      department,
      githubUrl,
      internalNotes,
      joinDate,
      linkedinUrl,
      name,
      photoUrl,
      skills,
      trainingEndDate,
      trainingStartDate,
      trainingStatus,
    } = req.body;

    if (Number(requester.userId) !== profileId && !canManageProfiles(requester.role)) {
      res.status(403).json({ message: "Access denied" });
      return;
    }

    await prisma.user.update({
      data: {
        department,
        githubUrl,
        internalNotes: canManageProfiles(requester.role) ? internalNotes : undefined,
        joinDate: joinDate ? new Date(joinDate) : undefined,
        linkedinUrl,
        name,
        photoUrl,
        skills: Array.isArray(skills) ? skills : undefined,
        trainingEndDate: trainingEndDate ? new Date(trainingEndDate) : undefined,
        trainingStartDate: trainingStartDate ? new Date(trainingStartDate) : undefined,
        trainingStatus,
      },
      where: { id: profileId },
    });

    await createAuditLog(Number(requester.userId), "PROFILE_UPDATED", "users", String(profileId), {
      fields: ["department", "githubUrl", "internalNotes", "joinDate", "linkedinUrl", "name", "photoUrl", "skills", "trainingDates", "trainingStatus"],
    });

    res.json({ message: "Profile updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating profile" });
  }
});

router.patch("/:id/status", authenticate, requireRole("HR", "TEAM_LEAD"), async (req: Request, res: Response) => {
  try {
    const profileId = Number(req.params.id);
    const { status } = req.body;

    await prisma.user.update({
      data: { trainingStatus: status },
      where: { id: profileId },
    });
    await createNotification(profileId, `Training status changed to ${status}`);
    await createAuditLog(Number((req as any).user.userId), "TRAINING_STATUS_CHANGED", "users", String(profileId), {
      status,
    });

    res.json({ message: "Training status updated" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating training status" });
  }
});

export default router;
