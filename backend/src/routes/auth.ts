import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import crypto from "crypto";
import { prisma } from "../prisma";
import { authenticate } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { createAuditLog } from "../utils/activity";
import { sendInviteEmail } from "../utils/mailer";

const router = Router();
const roles = ["JUNIOR_DEV", "SENIOR_DEV", "TEAM_LEAD", "HR"] as const;

const toPublicUser = (user: any) => {
  const { passwordHash, mfaSecret, inviteToken, inviteExpiresAt, internalNotes, ...safeUser } = user;
  return safeUser;
};

router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({ message: "Email and password are required" });
      return;
    }

    const userRole = roles.includes(role) ? role : "JUNIOR_DEV";
    const hashedPassword = await bcrypt.hash(password, 10);
    const secret = speakeasy.generateSecret();
    const user = await prisma.user.create({
      data: {
        email,
        mfaSecret: secret.base32,
        passwordHash: hashedPassword,
        role: userRole,
      },
    });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url || "");

    res.status(201).json({
      message: "User registered",
      qrCode,
      user: toPublicUser(user),
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      res.status(400).json({ message: "Email already exists" });
      return;
    }

    console.error(error);
    res.status(500).json({ message: "Error registering user" });
  }
});

router.post("/invite", authenticate, requireRole("HR"), async (req: Request, res: Response) => {
  try {
    const { email, role = "JUNIOR_DEV", name = "", department = "" } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedName = String(name || "").trim();
    const normalizedDepartment = String(department || "").trim();

    if (!normalizedEmail) {
      res.status(400).json({ message: "Email is required" });
      return;
    }

    const userRole = roles.includes(role) ? role : "JUNIOR_DEV";
    const inviteToken = crypto.randomBytes(24).toString("hex");
    const temporaryPassword = await bcrypt.hash(crypto.randomBytes(16).toString("hex"), 10);
    const secret = speakeasy.generateSecret();
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    let user;
    let inviteMode: "created" | "resent" = "created";

    if (existingUser) {
      const isPendingInvite = Boolean(existingUser.inviteToken || existingUser.inviteExpiresAt);

      if (!isPendingInvite) {
        res.status(400).json({ message: "Email already exists as an active account" });
        return;
      }

      user = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          department: normalizedDepartment,
          inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviteToken,
          mfaSecret: secret.base32,
          name: normalizedName,
          passwordHash: temporaryPassword,
          role: userRole,
        },
      });
      inviteMode = "resent";
    } else {
      user = await prisma.user.create({
        data: {
          department: normalizedDepartment,
          email: normalizedEmail,
          inviteExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          inviteToken,
          mfaSecret: secret.base32,
          name: normalizedName,
          passwordHash: temporaryPassword,
          role: userRole,
        },
      });
    }

    await createAuditLog(Number((req as any).user.userId), "USER_INVITED", "users", String(user.id), {
      email: normalizedEmail,
      inviteMode,
      role: userRole,
    });

    const inviteLink = `${process.env.FRONTEND_URL || "http://localhost:3000"}/setup-profile?token=${inviteToken}`;
    let emailSent = false;
    let emailError: string | undefined;

    try {
      emailSent = await sendInviteEmail(normalizedEmail, inviteLink);
    } catch (error: any) {
      emailSent = false;
      emailError = error?.message || "Invite email failed to send";
      console.error("Invite email error:", error);
    }

    res.status(201).json({
      emailSent,
      emailError,
      inviteLink,
      message: inviteMode === "resent" ? "Invite resent" : "Invite created",
      inviteMode,
      user: toPublicUser(user),
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error creating invite" });
  }
});

router.get("/invite-preview", async (req: Request, res: Response) => {
  try {
    const token = String(req.query.token || "");

    if (!token) {
      res.status(400).json({ message: "Invite token is required" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        inviteExpiresAt: { gt: new Date() },
        inviteToken: token,
      },
      select: {
        department: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      res.status(404).json({ message: "Invalid or expired invite" });
      return;
    }

    res.json({ invite: user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching invite details" });
  }
});

router.post("/setup-profile", async (req: Request, res: Response) => {
  try {
    const { token, password, name, skills, photoUrl, githubUrl, linkedinUrl } = req.body;

    if (!token || !password) {
      res.status(400).json({ message: "Invite token and password are required" });
      return;
    }

    const user = await prisma.user.findFirst({
      where: {
        inviteExpiresAt: { gt: new Date() },
        inviteToken: token,
      },
    });

    if (!user) {
      res.status(400).json({ message: "Invalid or expired invite" });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const secret = speakeasy.generateSecret();
    await prisma.user.update({
      data: {
        githubUrl,
        inviteExpiresAt: null,
        inviteToken: null,
        linkedinUrl,
        mfaSecret: secret.base32,
        name,
        passwordHash: hashedPassword,
        photoUrl,
        skills: Array.isArray(skills) ? skills : [],
      },
      where: { id: user.id },
    });
    const qrCode = await QRCode.toDataURL(secret.otpauth_url || "");

    res.json({ message: "Profile setup complete", qrCode });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error setting up profile" });
  }
});

router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (!isMatch) {
      res.status(401).json({ message: "Invalid credentials" });
      return;
    }

    res.json({ email, message: "Password verified, enter OTP" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error logging in" });
  }
});

router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !user.mfaSecret) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: "base32",
      token: otp,
      window: 1,
    });

    if (!verified) {
      res.status(400).json({ message: "Invalid OTP" });
      return;
    }

    const token = jwt.sign(
      {
        email: user.email,
        role: user.role,
        userId: user.id,
      },
      process.env.JWT_SECRET || "dev-secret",
      { expiresIn: "1h" }
    );

    res.cookie("token", token, {
      httpOnly: true,
      maxAge: 60 * 60 * 1000,
      sameSite: "lax",
      secure: false,
    });

    res.json({ message: "Login successful", token, user: toPublicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token", {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
  });
  res.json({ message: "Logged out" });
});

router.get("/me", authenticate, async (req: Request, res: Response) => {
  try {
    const userId = Number((req as any).user.userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.json({ user: toPublicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching current user" });
  }
});

router.get("/users", authenticate, requireRole("HR", "TEAM_LEAD"), async (_req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { email: "asc" },
      select: {
        department: true,
        email: true,
        id: true,
        inviteExpiresAt: true,
        name: true,
        role: true,
        trainingStatus: true,
      },
    });

    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error fetching users" });
  }
});

router.patch("/users/:id/role", authenticate, requireRole("HR"), async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.id);
    const { role } = req.body;

    if (!roles.includes(role)) {
      res.status(400).json({ message: "Invalid role" });
      return;
    }

    const before = await prisma.user.findUnique({ where: { id: userId } });
    const user = await prisma.user.update({
      data: { role },
      where: { id: userId },
    });

    await createAuditLog(Number((req as any).user.userId), "ROLE_CHANGED", "users", String(userId), {
      newRole: role,
      oldRole: before?.role,
    });

    res.json({ message: "Role updated", user: toPublicUser(user) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error updating role" });
  }
});

router.delete("/users/:id", authenticate, requireRole("HR", "TEAM_LEAD"), async (req: Request, res: Response) => {
  try {
    const requester = (req as any).user;
    const userId = Number(req.params.id);

    if (!userId) {
      res.status(400).json({ message: "Invalid user id" });
      return;
    }

    if (Number(requester.userId) === userId) {
      res.status(400).json({ message: "You cannot delete your own account while signed in." });
      return;
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, id: true, role: true },
    });

    if (!existingUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    await prisma.$transaction([
      prisma.auditLog.deleteMany({
        where: {
          OR: [{ actorId: userId }, { entityType: "users", entityId: String(userId) }],
        },
      }),
      prisma.notification.deleteMany({ where: { userId } }),
      prisma.feedback.deleteMany({
        where: {
          OR: [{ authorId: userId }, { developerId: userId }],
        },
      }),
      prisma.task.deleteMany({
        where: {
          OR: [{ assignedById: userId }, { assignedToId: userId }],
        },
      }),
      prisma.user.delete({ where: { id: userId } }),
    ]);

    await createAuditLog(Number(requester.userId), "USER_DELETED", "users", String(userId), {
      deletedEmail: existingUser.email,
      deletedRole: existingUser.role,
    });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error deleting user" });
  }
});

router.get("/protected", authenticate, requireRole("HR", "TEAM_LEAD"), (req: Request, res: Response) => {
  res.json({
    message: "You are authorized",
    user: (req as any).user,
  });
});

export default router;
