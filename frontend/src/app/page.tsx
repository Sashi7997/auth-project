"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

type Role = "JUNIOR_DEV" | "SENIOR_DEV" | "TEAM_LEAD" | "HR";
type Page = "home" | "dashboard" | "profile" | "tasks" | "feedback" | "notifications" | "users" | "audit";
type TaskStatus = "ASSIGNED" | "IN_PROGRESS" | "SUBMITTED" | "REVIEWED" | "NEEDS_REVISION" | "COMPLETED";
type FeedbackType = "EXTERNAL" | "INTERNAL";

type Profile = {
  id: number;
  email: string;
  role: Role;
  name?: string;
  department?: string;
  photoUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
  skills?: string[];
  trainingStatus?: string;
  trainingStartDate?: string;
  trainingEndDate?: string;
  joinDate?: string;
  internalNotes?: string;
  inviteExpiresAt?: string | null;
};

type TrainingTask = {
  id: string;
  title: string;
  description: string;
  priority: string;
  dueDate?: string;
  status: TaskStatus;
  attachments: string[];
};

type Feedback = {
  id: string;
  content: string;
  type: FeedbackType;
  developerId: number;
  authorId?: number;
  createdAt?: string;
};

type NotificationItem = {
  id: string;
  message: string;
  readAt?: string | null;
};

type AuditLog = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string;
  actorId?: number;
  details?: Record<string, any> | null;
  metadata?: Record<string, any> | null;
  createdAt?: string;
};

type InvitePreview = {
  email: string;
  role: Role;
  name?: string;
  department?: string;
};

const roles: Role[] = ["JUNIOR_DEV", "SENIOR_DEV", "TEAM_LEAD", "HR"];
const statuses = ["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "FAILED"];
const taskStatuses: TaskStatus[] = ["ASSIGNED", "IN_PROGRESS", "SUBMITTED", "REVIEWED", "NEEDS_REVISION", "COMPLETED"];

const canAddExternalFeedback = (role: Role) => ["SENIOR_DEV", "TEAM_LEAD", "HR"].includes(role);
const canAddInternalFeedback = (role: Role) => ["TEAM_LEAD", "HR"].includes(role);

const getTaskStatusOptions = (currentStatus: TaskStatus, role: Role): TaskStatus[] => {
  if (role === "HR" || role === "TEAM_LEAD") {
    const reviewerMap: Record<TaskStatus, TaskStatus[]> = {
      ASSIGNED: ["ASSIGNED", "IN_PROGRESS"],
      IN_PROGRESS: ["IN_PROGRESS", "SUBMITTED"],
      SUBMITTED: ["SUBMITTED", "REVIEWED", "NEEDS_REVISION"],
      REVIEWED: ["REVIEWED", "COMPLETED", "NEEDS_REVISION"],
      NEEDS_REVISION: ["NEEDS_REVISION", "IN_PROGRESS", "SUBMITTED"],
      COMPLETED: ["COMPLETED"],
    };

    return reviewerMap[currentStatus] || [currentStatus];
  }

  const developerMap: Record<TaskStatus, TaskStatus[]> = {
    ASSIGNED: ["ASSIGNED", "IN_PROGRESS"],
    IN_PROGRESS: ["IN_PROGRESS", "SUBMITTED"],
    SUBMITTED: ["SUBMITTED"],
    REVIEWED: ["REVIEWED"],
    NEEDS_REVISION: ["NEEDS_REVISION", "IN_PROGRESS", "SUBMITTED"],
    COMPLETED: ["COMPLETED"],
  };

  return developerMap[currentStatus] || [currentStatus];
};

export default function Home() {
  const [page, setPage] = useState<Page>("home");
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"home" | "login" | "register" | "setup">("home");
  const [step, setStep] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<Role>("JUNIOR_DEV");
  const [otp, setOtp] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [dashboardTasks, setDashboardTasks] = useState<TrainingTask[]>([]);
  const [dashboardStats, setDashboardStats] = useState({
    overdueTasks: 0,
    pendingReview: 0,
    progress: 0,
  });
  const [dashboardFilters, setDashboardFilters] = useState({
    department: "ALL",
    role: "ALL",
    status: "ALL",
  });
  const [selectedProfileId, setSelectedProfileId] = useState<number | null>(null);
  const [selectedTaskUserId, setSelectedTaskUserId] = useState<number | null>(null);
  const [selectedFeedbackUserId, setSelectedFeedbackUserId] = useState<number | null>(null);
  const [profileForm, setProfileForm] = useState({
    department: "",
    githubUrl: "",
    internalNotes: "",
    joinDate: "",
    linkedinUrl: "",
    name: "",
    photoUrl: "",
    skills: "",
    trainingEndDate: "",
    trainingStartDate: "",
    trainingStatus: "NOT_STARTED",
  });
  const [taskForm, setTaskForm] = useState({
    assignedTo: "",
    attachments: "",
    description: "",
    dueDate: "",
    priority: "MEDIUM",
    title: "",
  });
  const [feedbackForm, setFeedbackForm] = useState({ content: "", developerId: "", type: "EXTERNAL" as FeedbackType });
  const [inviteForm, setInviteForm] = useState({ department: "", email: "", name: "", role: "JUNIOR_DEV" as Role });
  const [inviteLink, setInviteLink] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const [previousPage, setPreviousPage] = useState<Page | null>(null);

  const switchAuthMode = (mode: "home" | "login" | "register") => {
    setAuthMode(mode);
    setStep("password");
    setQrCode("");
    setSetupComplete(false);
    setMessage("");
    setSessionExpired(false);
  };

  const navigateToPage = (nextPage: Page) => {
    if (page !== nextPage) {
      setPreviousPage(page);
    }
    setPage(nextPage);
    setNavMenuOpen(false);
  };

  const goBack = () => {
    if (previousPage) {
      const target = previousPage;
      setPreviousPage(page);
      setPage(target);
      setNavMenuOpen(false);
      return;
    }

    setPage("dashboard");
    setNavMenuOpen(false);
  };

  const isLeadOrHr = profile?.role === "HR" || profile?.role === "TEAM_LEAD";
  const isHr = profile?.role === "HR";
  const canCreateExternalFeedback = profile ? canAddExternalFeedback(profile.role) : false;
  const canCreateInternalFeedback = profile ? canAddInternalFeedback(profile.role) : false;
  const unread = notifications.filter((item) => !item.readAt).length;
  const filteredProfiles = profiles.filter((item) => {
    const statusMatch = dashboardFilters.status === "ALL" || item.trainingStatus === dashboardFilters.status;
    const departmentMatch = dashboardFilters.department === "ALL" || item.department === dashboardFilters.department;
    const roleMatch = dashboardFilters.role === "ALL" || item.role === dashboardFilters.role;
    return statusMatch && departmentMatch && roleMatch;
  });
  const departmentOptions = Array.from(new Set(profiles.map((item) => item.department).filter(Boolean))) as string[];

  const resetSession = async (reason?: string) => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // We still want local UI state cleared if the server call fails.
    }

    setProfile(null);
    setProfiles([]);
    setTasks([]);
    setFeedback([]);
    setNotifications([]);
    setAuditLogs([]);
    setSelectedProfileId(null);
    setSelectedTaskUserId(null);
    setSelectedFeedbackUserId(null);
    setStep("password");
    setAuthMode("login");
    setSessionExpired(Boolean(reason));
    setMessage(reason || "");
  };

  const getErrorMessage = (error: any, fallback: string) => {
    return error?.response?.data?.message || fallback;
  };

  const handleRequestError = async (error: any, fallback: string) => {
    if (error?.response?.status === 401) {
      await resetSession("Your session expired. Please sign in again.");
      return;
    }

    setMessage(getErrorMessage(error, fallback));
  };

  const syncProfileForm = (current: Profile) => {
    setProfileForm({
      department: current.department || "",
      githubUrl: current.githubUrl || "",
      internalNotes: current.internalNotes || "",
      joinDate: current.joinDate?.slice(0, 10) || "",
      linkedinUrl: current.linkedinUrl || "",
      name: current.name || "",
      photoUrl: current.photoUrl || "",
      skills: current.skills?.join(", ") || "",
      trainingEndDate: current.trainingEndDate?.slice(0, 10) || "",
      trainingStartDate: current.trainingStartDate?.slice(0, 10) || "",
      trainingStatus: current.trainingStatus || "NOT_STARTED",
    });
  };

  const loadTasksForUser = async (userId: number) => {
    const taskResponse = await api.get<TrainingTask[]>(`/tasks/${userId}`);
    setTasks(taskResponse.data);
    setSelectedTaskUserId(userId);
  };

  const loadFeedbackForUser = async (userId: number) => {
    const feedbackResponse = await api.get<Feedback[]>(`/feedback/${userId}`);
    setFeedback(feedbackResponse.data);
    setSelectedFeedbackUserId(userId);
    setFeedbackForm((value) => ({ ...value, developerId: String(userId) }));
  };

  const loadProfileForEditor = async (userId: number) => {
    const profileResponse = await api.get<Profile>(`/profile/${userId}`);
    syncProfileForm(profileResponse.data);
    setSelectedProfileId(userId);
  };

  const buildDashboardStats = (items: TrainingTask[]) => {
    setDashboardTasks(items);
    const completed = items.filter((task) => task.status === "COMPLETED").length;
    const pendingReview = items.filter((task) => task.status === "SUBMITTED").length;
    const overdueTasks = items.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "COMPLETED").length;

    setDashboardStats({
      overdueTasks,
      pendingReview,
      progress: items.length ? Math.round((completed / items.length) * 100) : 0,
    });
  };

  const loadData = async (options?: { resetToHome?: boolean }) => {
    try {
      const profileResponse = await api.get<Profile>("/profile");
      const current = profileResponse.data;
      setProfile(current);
      if (options?.resetToHome) {
        setPage("home");
      }
      setSessionExpired(false);
      syncProfileForm(current);
      setSelectedProfileId(current.id);
      setTaskForm((value) => ({ ...value, assignedTo: String(current.id) }));
      setFeedbackForm((value) => ({ ...value, developerId: String(current.id) }));

      const [taskResponse, notificationResponse, feedbackResponse] = await Promise.all([
        api.get<TrainingTask[]>(`/tasks/${current.id}`),
        api.get<NotificationItem[]>("/notifications"),
        api.get<Feedback[]>(`/feedback/${current.id}`),
      ]);
      setTasks(taskResponse.data);
      setNotifications(notificationResponse.data);
      setFeedback(feedbackResponse.data);
      setSelectedTaskUserId(current.id);
      setSelectedFeedbackUserId(current.id);
      buildDashboardStats(taskResponse.data);

      if (current.role === "HR" || current.role === "TEAM_LEAD") {
        const [profileList, auditResponse] = await Promise.all([
          api.get<Profile[]>("/profile/all"),
          api.get<AuditLog[]>("/audit"),
        ]);
        setProfiles(profileList.data);
        setAuditLogs(auditResponse.data);

        const teamTaskResponses = await Promise.all(
          profileList.data.map((item) => api.get<TrainingTask[]>(`/tasks/${item.id}`))
        );
        buildDashboardStats(teamTaskResponses.flatMap((response) => response.data));
      } else {
        setProfiles([current]);
        setAuditLogs([]);
      }
    } catch (error: any) {
      await handleRequestError(error, "Unable to load your workspace right now.");
      throw error;
    }
  };

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) {
      setSetupToken(token);
      setAuthMode("setup");
      api
        .get<{ invite: InvitePreview }>(`/auth/invite-preview?token=${encodeURIComponent(token)}`)
        .then((response) => setInvitePreview(response.data.invite))
        .catch(() => setMessage("This invite link is invalid or has expired."));
      return;
    }

    api
      .get<{ user: Profile }>("/auth/me")
      .then(() => loadData({ resetToHome: true }))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!invitePreview) {
      return;
    }

    setProfileForm((value) => ({
      ...value,
      name: value.name || invitePreview.name || "",
    }));
  }, [invitePreview]);

  useEffect(() => {
    if (!message || sessionExpired) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMessage("");
    }, 3200);

    return () => window.clearTimeout(timeoutId);
  }, [message, sessionExpired]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const handleHomeClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const button = target?.closest("button");

      if (!button || !button.closest(".nav-compact") || button.textContent?.trim() !== "Home") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      setPreviousPage(page);
      setPage("home");
      setNavMenuOpen(false);
    };

    document.addEventListener("click", handleHomeClick, true);

    return () => {
      document.removeEventListener("click", handleHomeClick, true);
    };
  }, [page, profile]);

  useEffect(() => {
    if (!profile) {
      return;
    }

    const interval = window.setInterval(async () => {
      try {
        const notificationResponse = await api.get<NotificationItem[]>("/notifications");
        setNotifications(notificationResponse.data);
      } catch (error) {
        // Quiet polling failure; explicit actions still surface errors.
      }
    }, 10000);

    return () => window.clearInterval(interval);
  }, [profile]);

  const login = async () => {
    try {
      setSessionExpired(false);
      setMessage("");
      await api.post("/auth/login", { email, password });
      setStep("otp");
      setSessionExpired(false);
      setMessage("Password verified. Enter your OTP.");
    } catch (error: any) {
      await handleRequestError(error, "Login failed. Check that the backend is running and the account exists.");
    }
  };

  const register = async () => {
    try {
      setSessionExpired(false);
      setMessage("");
      const response = await api.post("/auth/register", { email, password, role: registerRole });
      setQrCode(response.data.qrCode);
      setMessage("Registered. Scan the QR code, then press Continue to verify your first OTP.");
      setStep("otp");
    } catch (error: any) {
      await handleRequestError(error, "Registration failed. Check the backend terminal.");
    }
  };

  const verify = async () => {
    try {
      setSessionExpired(false);
      setMessage("");
      const response = await api.post("/auth/verify-otp", { email, otp });
      setProfile(response.data.user);
      setQrCode("");
      setStep("password");
      setMessage("");
      try {
        await loadData();
      } catch (error) {
        setMessage("Welcome back. Dashboard loaded, but some tracker data could not load yet.");
      }
    } catch (error: any) {
      await handleRequestError(error, "OTP verification failed.");
    }
  };

  const setupProfile = async () => {
    try {
      const response = await api.post("/auth/setup-profile", {
        githubUrl: profileForm.githubUrl,
        linkedinUrl: profileForm.linkedinUrl,
        name: profileForm.name,
        password,
        photoUrl: profileForm.photoUrl,
        skills: profileForm.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
        token: setupToken,
      });
      setQrCode(response.data.qrCode);
      setSetupComplete(true);
      setMessage("Profile setup complete. Scan the QR code in your authenticator app, then continue to login.");
    } catch (error: any) {
      await handleRequestError(error, "Profile setup failed.");
    }
  };

  const saveProfile = async () => {
    try {
      const payload = {
        ...profileForm,
        skills: profileForm.skills.split(",").map((skill) => skill.trim()).filter(Boolean),
      };
      if (isLeadOrHr && selectedProfileId) {
        await api.patch(`/profile/${selectedProfileId}`, payload);
      } else {
        await api.patch("/profile", payload);
      }
      setMessage("Profile saved.");
      await loadData();
    } catch (error: any) {
      await handleRequestError(error, "Profile save failed.");
    }
  };

  const assignTask = async () => {
    try {
      await api.post("/tasks/assign", {
        ...taskForm,
        attachments: taskForm.attachments.split(",").map((item) => item.trim()).filter(Boolean),
      });
      setMessage("Task assigned.");
      await loadData();
    } catch (error: any) {
      await handleRequestError(error, "Task assignment failed.");
    }
  };

  const updateTask = async (taskId: string, status: TaskStatus) => {
    try {
      await api.patch(`/tasks/${taskId}/status`, { status });
      setMessage("Task updated.");
      await loadData();
    } catch (error: any) {
      await handleRequestError(error, "Task update failed.");
    }
  };

  const addFeedback = async () => {
    try {
      const developerId = selectedFeedbackUserId ?? Number(feedbackForm.developerId);

      if (!developerId || Number.isNaN(developerId)) {
        setMessage("Select a developer before adding feedback.");
        return;
      }

      await api.post("/feedback", {
        ...feedbackForm,
        developerId,
      });
      setMessage("Feedback added.");
      setFeedbackForm((value) => ({ ...value, developerId: String(developerId), content: "" }));
      if (selectedFeedbackUserId ?? developerId) {
        await loadFeedbackForUser(selectedFeedbackUserId ?? developerId);
      } else {
        await loadData();
      }
    } catch (error: any) {
      await handleRequestError(error, "Feedback failed.");
    }
  };

  const inviteUser = async () => {
    try {
      const response = await api.post("/auth/invite", inviteForm);
      setInviteLink(response.data.inviteLink);
      setMessage(
        response.data.emailSent
          ? `${response.data.inviteMode === "resent" ? "Invite email resent" : "Invite email sent"} to ${inviteForm.email}.`
          : response.data.emailError
            ? `${response.data.inviteMode === "resent" ? "Invite updated" : "Invite created"}, but email delivery failed: ${response.data.emailError}`
            : "Invite created, but email was not sent because SMTP is not configured on the backend."
      );
      await loadData();
    } catch (error: any) {
      setInviteLink("");
      await handleRequestError(error, "Invite failed.");
    }
  };

  const resendInvite = async (target: Profile) => {
    try {
      const response = await api.post("/auth/invite", {
        department: target.department || "",
        email: target.email,
        name: target.name || "",
        role: target.role,
      });
      setInviteLink(response.data.inviteLink);
      setMessage(
        response.data.emailSent
          ? `Invite email resent to ${target.email}.`
          : response.data.emailError
            ? `Invite refreshed for ${target.email}, but delivery failed: ${response.data.emailError}`
            : `Invite refreshed for ${target.email}, but SMTP is not configured.`
      );
      await loadData();
    } catch (error: any) {
      await handleRequestError(error, "Unable to resend invite.");
    }
  };

  const updateRole = async (userId: number, role: Role) => {
    try {
      await api.patch(`/auth/users/${userId}/role`, { role });
      setMessage("Role updated.");
      await loadData();
    } catch (error: any) {
      await handleRequestError(error, "Role update failed.");
    }
  };

  const deleteUser = async (userId: number, userLabel: string) => {
    const confirmed = window.confirm(`Delete ${userLabel}'s account? This will remove their tasks, feedback, notifications, and profile data.`);

    if (!confirmed) {
      return;
    }

    try {
      await api.delete(`/auth/users/${userId}`);
      setMessage("User deleted.");
      if (selectedProfileId === userId) {
        setSelectedProfileId(profile?.id ?? null);
      }
      if (selectedTaskUserId === userId) {
        setSelectedTaskUserId(profile?.id ?? null);
      }
      if (selectedFeedbackUserId === userId) {
        setSelectedFeedbackUserId(profile?.id ?? null);
      }
      await loadData();
    } catch (error: any) {
      await handleRequestError(error, "Unable to delete that user right now.");
    }
  };

  const markRead = async (id: string) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      await loadData();
    } catch (error) {
      await handleRequestError(error, "Unable to update that notification right now.");
    }
  };

  const openNotification = async (item: NotificationItem) => {
    try {
      await api.patch(`/notifications/${item.id}/read`);
    } catch (error) {
      await handleRequestError(error, "Unable to open that notification right now.");
      return;
    }

    const messageText = item.message.toLowerCase();
    const developerIdMatch = item.message.match(/developerId:(\d+)/i);
    const targetDeveloperId = developerIdMatch ? Number(developerIdMatch[1]) : null;

    if (messageText.includes("feedback")) {
      setPage("feedback");
      if (targetDeveloperId) {
        await loadFeedbackForUser(targetDeveloperId);
      } else if (selectedFeedbackUserId) {
        await loadFeedbackForUser(selectedFeedbackUserId);
      } else {
        await loadData();
      }
      return;
    }

    if (messageText.includes("task")) {
      setPage("tasks");
      if (targetDeveloperId) {
        await loadTasksForUser(targetDeveloperId);
      } else if (selectedTaskUserId) {
        await loadTasksForUser(selectedTaskUserId);
      } else {
        await loadData();
      }
      return;
    }

    setPage("dashboard");
    await loadData();
  };

  const markAllNotificationsRead = async () => {
    try {
      await Promise.all(
        notifications
          .filter((item) => !item.readAt)
          .map((item) => api.patch(`/notifications/${item.id}/read`))
      );
      setMessage("All notifications marked as read.");
      await loadData();
    } catch (error) {
      await handleRequestError(error, "Unable to mark every notification as read right now.");
    }
  };

  const logout = async () => {
    setNavMenuOpen(false);
    await resetSession("Logged out.");
  };

  if (!profile) {
    if (authMode === "home") {
      return (
        <main className="auth-panel auth-home-panel">
          <section className="landing-shell">
            <div className="landing-visual">
              <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1600&q=80" alt="Team workshop" />
              <div className="landing-visual-copy">
                <p className="eyebrow">Training Tracker</p>
                <h1>Build every training journey in one place.</h1>
                <p>
                  Assign work, collect layered feedback, review submissions, and keep HR and Team Leads aligned from a single workspace.
                </p>
              </div>
            </div>

            <section className="landing-content">
              <div className="stack" style={{ gap: 12 }}>
                <p className="eyebrow">Welcome</p>
                <h2>Start here</h2>
                <p className="hero-note">
                  Sign in to continue, register a new account, or complete an invite-based setup from the secure link sent by HR.
                </p>
              </div>

              <div className="landing-feature-grid">
                <article className="landing-feature-card">
                  <strong>Profiles</strong>
                  <h3>Role-aware records</h3>
                  <p>Profiles, training dates, links, and private notes stay organized and visible to the right people.</p>
                </article>
                <article className="landing-feature-card">
                  <strong>Review Flow</strong>
                  <h3>Submission review</h3>
                  <p>Tasks move from assignment to review with notifications and reviewer actions built in.</p>
                </article>
                <article className="landing-feature-card">
                  <strong>Visibility</strong>
                  <h3>Structured feedback</h3>
                  <p>External and internal notes stay separated cleanly so the right people see the right context.</p>
                </article>
              </div>

              <div className="landing-actions">
                <button onClick={() => switchAuthMode("login")}>Login</button>
                <button className="secondary" onClick={() => switchAuthMode("register")}>Register</button>
              </div>
            </section>
          </section>
        </main>
      );
    }

    return (
      <main className="auth-panel">
        <section className="auth-art">
          <img src="https://images.unsplash.com/photo-1552664730-d307ca884978?auto=format&fit=crop&w=1400&q=80" alt="Team workshop" />
          <div>
            <h1>Profile Training Tracker</h1>
            <p>Move every developer through a clear training path with tasks, feedback, visibility rules, and accountable progress.</p>
          </div>
        </section>
        <section className="auth-card stack">
          <div className="row auth-top-actions">
            <button className="secondary" onClick={() => switchAuthMode("home")}>Home</button>
            <button className="secondary" onClick={() => switchAuthMode("home")}>Back</button>
          </div>
          <h2>{authMode === "setup" ? "Complete Invite" : authMode === "register" ? "Create Account" : "Sign In"}</h2>
          {message && <p className="message">{message}</p>}
          {sessionExpired && !message && <p className="message">Sign in again to continue.</p>}
          {authMode !== "setup" && (
            <div className="row">
              <button className={authMode === "login" ? "" : "secondary"} onClick={() => switchAuthMode("login")}>Login</button>
              <button className={authMode === "register" ? "" : "secondary"} onClick={() => switchAuthMode("register")}>Register</button>
            </div>
          )}
          {authMode === "register" && step === "password" && (
            <label>
              Role
              <select value={registerRole} onChange={(event) => setRegisterRole(event.target.value as Role)}>
                {roles.map((role) => <option key={role}>{role}</option>)}
              </select>
            </label>
          )}
          {authMode === "setup" ? (
            <>
              {invitePreview && (
                <div className="card stack">
                  <div>
                    <p className="eyebrow">Invite Details</p>
                    <h3 style={{ margin: "8px 0 0" }}>{invitePreview.name || invitePreview.email}</h3>
                  </div>
                  <div className="detail-list compact">
                    <div>
                      <span>Email</span>
                      <strong>{invitePreview.email}</strong>
                    </div>
                    <div>
                      <span>Role</span>
                      <strong>{invitePreview.role}</strong>
                    </div>
                    <div>
                      <span>Department</span>
                      <strong>{invitePreview.department || "Not assigned"}</strong>
                    </div>
                  </div>
                </div>
              )}
              <label>Full Name<input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label>Skills<input value={profileForm.skills} onChange={(event) => setProfileForm({ ...profileForm, skills: event.target.value })} /></label>
              <label>GitHub URL<input value={profileForm.githubUrl} onChange={(event) => setProfileForm({ ...profileForm, githubUrl: event.target.value })} /></label>
              <label>LinkedIn URL<input value={profileForm.linkedinUrl} onChange={(event) => setProfileForm({ ...profileForm, linkedinUrl: event.target.value })} /></label>
              <button onClick={setupProfile}>Finish Setup</button>
              {qrCode && (
                <div className="card stack">
                  <div>
                    <p className="eyebrow">Authenticator Setup</p>
                    <h3 style={{ margin: "8px 0 0" }}>Scan this QR code</h3>
                  </div>
                  <p style={{ margin: 0 }}>Use Google Authenticator or any compatible authenticator app, then return here and go to login.</p>
                  <img src={qrCode} alt="Authenticator QR code" style={{ maxWidth: 220 }} />
                  <button className="secondary" onClick={() => switchAuthMode("login")}>Go To Login</button>
                </div>
              )}
            </>
          ) : step === "otp" ? (
            <>
              <label>OTP<input value={otp} onChange={(event) => {
                setSessionExpired(false);
                setMessage("");
                setOtp(event.target.value);
              }} /></label>
              <button onClick={verify}>Verify</button>
            </>
          ) : (
            <>
              <label>Email<input value={email} onChange={(event) => {
                setSessionExpired(false);
                setMessage("");
                setEmail(event.target.value);
              }} /></label>
              <label>Password<input type="password" value={password} onChange={(event) => {
                setSessionExpired(false);
                setMessage("");
                setPassword(event.target.value);
              }} /></label>
              <button onClick={authMode === "register" ? register : login}>{authMode === "register" ? "Register" : "Continue"}</button>
            </>
          )}
          {qrCode && authMode !== "login" && !setupComplete && <img src={qrCode} alt="Authenticator QR code" style={{ maxWidth: 220 }} />}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <img src={profile.photoUrl || "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=200&q=80"} alt={profile.name || profile.email} />
          <div>
            <strong>Training Tracker</strong>
            <div>{profile.name || profile.email} · {profile.role}</div>
          </div>
        </div>
        <nav className="nav nav-compact">
          <button className="secondary" onClick={goBack}>Back</button>
          <button
            className={page === "dashboard" ? "active" : ""}
            onClick={() => {
              navigateToPage("dashboard");
            }}
          >
            Home
          </button>
          <button
            className={`nav-menu-toggle ${navMenuOpen ? "open" : ""}`}
            onClick={() => setNavMenuOpen((value) => !value)}
            aria-expanded={navMenuOpen}
            aria-label="Open navigation menu"
            type="button"
          >
            ...
          </button>
          <div className={`nav-menu ${navMenuOpen ? "open" : ""}`}>
            {(["dashboard", "profile", "tasks", "feedback", "notifications"] as Page[]).map((item) => (
              <button
                key={item}
                className={page === item ? "active" : ""}
                onClick={() => {
                  navigateToPage(item);
                }}
              >
                {item === "notifications" ? `Notifications${unread ? ` (${unread})` : ""}` : item.charAt(0).toUpperCase() + item.slice(1)}
              </button>
            ))}
            {isHr && (
              <button
                className={page === "users" ? "active" : ""}
                onClick={() => {
                  navigateToPage("users");
                }}
              >
                Users
              </button>
            )}
            {isLeadOrHr && (
              <button
                className={page === "audit" ? "active" : ""}
                onClick={() => {
                  navigateToPage("audit");
                }}
              >
                Audit
              </button>
            )}
            <button className="danger" onClick={logout}>Logout</button>
          </div>
        </nav>
      </header>
      <section className="workspace">
        {message && <p className="message">{message}</p>}
        {page === "home" && <WorkspaceHome profile={profile} progress={dashboardStats.progress} unread={unread} tasks={tasks} notifications={notifications} onOpenPage={setPage} canManageUsers={Boolean(isLeadOrHr)} />}
        {page === "dashboard" && <Dashboard progress={dashboardStats.progress} pendingReview={dashboardStats.pendingReview} overdueTasks={dashboardStats.overdueTasks} tasks={dashboardTasks} notifications={notifications} profiles={filteredProfiles} markRead={markRead} isLeadOrHr={Boolean(isLeadOrHr)} filters={dashboardFilters} setFilters={setDashboardFilters} departments={departmentOptions} />}
        {page === "profile" && <ProfileEditor form={profileForm} setForm={setProfileForm} save={saveProfile} isLeadOrHr={Boolean(isLeadOrHr)} profiles={profiles} selectedProfileId={selectedProfileId} onSelectProfile={loadProfileForEditor} currentProfile={profiles.find((item) => item.id === selectedProfileId) || profile} />}
        {page === "tasks" && <Tasks tasks={tasks} profiles={profiles} form={taskForm} setForm={setTaskForm} assign={assignTask} updateTask={updateTask} isLeadOrHr={Boolean(isLeadOrHr)} selectedTaskUserId={selectedTaskUserId} onSelectUser={loadTasksForUser} currentRole={profile.role} />}
        {page === "feedback" && <FeedbackPanel feedback={feedback} form={feedbackForm} setForm={setFeedbackForm} addFeedback={addFeedback} isLeadOrHr={Boolean(isLeadOrHr)} profiles={profiles} selectedFeedbackUserId={selectedFeedbackUserId} onSelectUser={loadFeedbackForUser} canCreateExternalFeedback={canCreateExternalFeedback} canCreateInternalFeedback={canCreateInternalFeedback} />}
        {page === "notifications" && <NotificationsCenter notifications={notifications} unread={unread} markRead={markRead} markAllRead={markAllNotificationsRead} openNotification={openNotification} />}
        {page === "users" && <UsersPageEnhanced profiles={profiles} inviteForm={inviteForm} setInviteForm={setInviteForm} inviteUser={inviteUser} inviteLink={inviteLink} updateRole={updateRole} resendInvite={resendInvite} deleteUser={deleteUser} currentUserId={profile.id} canManageRoles={Boolean(isHr)} />}
        {page === "audit" && <AuditTrailEnhanced logs={auditLogs} profiles={profiles} />}
      </section>
    </main>
  );
}

function WorkspaceHome({ profile, progress, unread, tasks, notifications, onOpenPage, canManageUsers }: { profile: Profile; progress: number; unread: number; tasks: TrainingTask[]; notifications: NotificationItem[]; onOpenPage: (page: Page) => void; canManageUsers: boolean }) {
  const submitted = tasks.filter((task) => task.status === "SUBMITTED").length;
  const completed = tasks.filter((task) => task.status === "COMPLETED").length;

  return (
    <div className="stack">
      <section className="workspace-home-hero">
        <div className="workspace-home-copy">
          <p className="eyebrow">Workspace Home</p>
          <h1>Welcome back, {profile.name || profile.email.split("@")[0]}.</h1>
          <p>Track training progress, review work, and jump straight into the parts of the workspace that need your attention.</p>
        </div>
        <div className="workspace-home-highlight">
          <span className="status-chip accent">{profile.role}</span>
          <strong>{unread}</strong>
          <p>Unread notifications waiting for you right now.</p>
        </div>
      </section>
      <div className="workspace-home-grid">
        <button className="workspace-home-card" onClick={() => onOpenPage("dashboard")} type="button">
          <span>Overview</span>
          <strong>{progress}%</strong>
          <p>See overall progress and current team activity.</p>
        </button>
        <button className="workspace-home-card" onClick={() => onOpenPage("tasks")} type="button">
          <span>Tasks</span>
          <strong>{tasks.length}</strong>
          <p>{submitted} waiting for review and {completed} already completed.</p>
        </button>
        <button className="workspace-home-card" onClick={() => onOpenPage("notifications")} type="button">
          <span>Notifications</span>
          <strong>{unread}</strong>
          <p>Open alerts, reminders, and review requests.</p>
        </button>
      </div>
      <div className="workspace-home-panel">
        <div>
          <p className="eyebrow">Quick Start</p>
          <h2>Use the menu to open your full workspace</h2>
          <p>The three-dots button in the header now opens the sidebar with every page inside it, so navigation stays clean and focused.</p>
        </div>
        <div className="workspace-home-actions">
          <button onClick={() => onOpenPage("profile")} type="button">Open Profile</button>
          <button className="secondary" onClick={() => onOpenPage("feedback")} type="button">View Feedback</button>
          {canManageUsers && <button className="secondary" onClick={() => onOpenPage("users")} type="button">Manage Users</button>}
        </div>
      </div>
      {notifications.length > 0 && (
        <div className="workspace-home-feed">
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <p className="eyebrow">Recent Activity</p>
              <h2>Latest notifications</h2>
            </div>
            <button className="secondary" onClick={() => onOpenPage("notifications")} type="button">See All</button>
          </div>
          <div className="workspace-home-list">
            {notifications.slice(0, 3).map((item) => (
              <div key={item.id} className="workspace-home-list-item">
                <span className={`status-chip ${item.readAt ? "muted" : "accent"}`}>{item.readAt ? "Read" : "New"}</span>
                <p>{item.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Dashboard({ progress, pendingReview, overdueTasks, tasks, notifications, profiles, markRead, isLeadOrHr, filters, setFilters, departments }: { progress: number; pendingReview: number; overdueTasks: number; tasks: TrainingTask[]; notifications: NotificationItem[]; profiles: Profile[]; markRead: (id: string) => void; isLeadOrHr: boolean; filters: { department: string; role: string; status: string }; setFilters: (value: { department: string; role: string; status: string }) => void; departments: string[] }) {
  return (
    <div className="stack">
      <section className="banner dashboard-hero">
        <div className="banner-copy">
          <p className="eyebrow">Operations Center</p>
          <h1>Training Dashboard</h1>
          <p className="dashboard-hero-note">
            Track progress, review submissions, and keep the training pipeline moving without losing visibility.
          </p>
        </div>
        <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80" alt="Planning board" />
      </section>
      <div className="dashboard-metrics">
        <div className="dashboard-stat">
          <strong>Progress</strong>
          <span>{progress}%</span>
          <progress max={100} value={progress} style={{ width: "100%" }} />
        </div>
        <div className="dashboard-stat">
          <strong>Pending Review</strong>
          <span>{tasks.filter((task) => task.status === "SUBMITTED").length}</span>
          <p>Items waiting for reviewer action</p>
        </div>
        <div className="dashboard-stat">
          <strong>Overdue Tasks</strong>
          <span>{tasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "COMPLETED").length}</span>
          <p>Assignments past due date</p>
        </div>
      </div>
          {isLeadOrHr && <div className="card"><h2>Developer Dashboards</h2><div className="form-grid"><label>Status<select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="ALL">All statuses</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label>Department<select value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}><option value="ALL">All departments</option>{departments.map((department) => <option key={department}>{department}</option>)}</select></label><label>Role<select value={filters.role} onChange={(event) => setFilters({ ...filters, role: event.target.value })}><option value="ALL">All roles</option>{roles.map((role) => <option key={role}>{role}</option>)}</select></label></div>{profiles.map((profile) => <p key={profile.id}>{profile.name || profile.email} · {profile.department || "No department"} · {profile.trainingStatus}</p>)}{profiles.length === 0 && <p>No profiles match the current filters.</p>}</div>}
      <div className="card"><h2>Notifications</h2>{notifications.length === 0 && <p>No notifications yet.</p>}{notifications.map((item) => <p key={item.id}>{item.message} {!item.readAt && <button className="secondary" onClick={() => markRead(item.id)}>Mark Read</button>}</p>)}</div>
    </div>
  );
}

function ProfileEditor({ form, setForm, save, isLeadOrHr, profiles, selectedProfileId, onSelectProfile, currentProfile }: { form: any; setForm: (value: any) => void; save: () => void; isLeadOrHr: boolean; profiles: Profile[]; selectedProfileId: number | null; onSelectProfile: (userId: number) => void; currentProfile: Profile }) {
  const handlePhotoSelect = (event: any) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setForm({
        ...form,
        photoUrl: "",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm({ ...form, photoUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return <div className="stack">
    <div className="profile-hero">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow">Profile Studio</p>
          <h2>Profile Management</h2>
        </div>
        {isLeadOrHr && <label style={{ minWidth: 260 }}>Developer<select value={selectedProfileId ?? ""} onChange={(event) => onSelectProfile(Number(event.target.value))}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name || profile.email}</option>)}</select></label>}
      </div>
      <p className="hero-note">Shape a polished public profile, keep training metadata current, and make the identity section feel like a real internal talent card.</p>
    </div>
    <div className="profile-layout">
      <div className="profile-panel identity-panel">
        <div className="identity-top">
          <img
            src={form.photoUrl || currentProfile.photoUrl || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80"}
            alt={currentProfile.name || currentProfile.email}
            className="profile-avatar"
          />
          <div className="stack" style={{ gap: 10 }}>
            <p className="eyebrow">Identity</p>
            <h3>{currentProfile.name || "Name not set"}</h3>
            <p>{currentProfile.email}</p>
            <div className="chip-row">
              <span className="status-chip">{currentProfile.role}</span>
              <span className="status-chip muted">{currentProfile.department || "Department not set"}</span>
              <span className="status-chip accent">{currentProfile.trainingStatus || "NOT_STARTED"}</span>
            </div>
          </div>
        </div>
        <div className="detail-list">
          <div>
            <span>Join Date</span>
            <strong>{currentProfile.joinDate ? currentProfile.joinDate.slice(0, 10) : "Not set"}</strong>
          </div>
          <div>
            <span>Training Start</span>
            <strong>{currentProfile.trainingStartDate ? currentProfile.trainingStartDate.slice(0, 10) : "Not set"}</strong>
          </div>
          <div>
            <span>Training End</span>
            <strong>{currentProfile.trainingEndDate ? currentProfile.trainingEndDate.slice(0, 10) : "Not set"}</strong>
          </div>
          <div>
            <span>Skills</span>
            <strong>{currentProfile.skills?.length ? currentProfile.skills.join(", ") : "Not set"}</strong>
          </div>
        </div>
        {isLeadOrHr && (
          <div className="internal-note-box">
            <span>Internal Notes</span>
            <p>{currentProfile.internalNotes || "No internal notes yet."}</p>
          </div>
        )}
      </div>
      <div className="profile-panel edit-panel">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow">Edit Workspace</p>
            <h3>Update details</h3>
          </div>
          <label className="upload-trigger">
            <span>Choose Photo</span>
            <input type="file" accept="image/*" onChange={handlePhotoSelect} />
          </label>
        </div>
        <div className="form-grid">
          <label>Full Name<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label>Skills<input value={form.skills} onChange={(event) => setForm({ ...form, skills: event.target.value })} /></label>
          <label>GitHub URL<input value={form.githubUrl} onChange={(event) => setForm({ ...form, githubUrl: event.target.value })} /></label>
          <label>LinkedIn URL<input value={form.linkedinUrl} onChange={(event) => setForm({ ...form, linkedinUrl: event.target.value })} /></label>
          {isLeadOrHr && <>
            <label>Department<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label>
            <label>Join Date<input type="date" value={form.joinDate} onChange={(event) => setForm({ ...form, joinDate: event.target.value })} /></label>
            <label>Training Start<input type="date" value={form.trainingStartDate} onChange={(event) => setForm({ ...form, trainingStartDate: event.target.value })} /></label>
            <label>Training End<input type="date" value={form.trainingEndDate} onChange={(event) => setForm({ ...form, trainingEndDate: event.target.value })} /></label>
            <label>Status<select value={form.trainingStatus} onChange={(event) => setForm({ ...form, trainingStatus: event.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label>
            <label>Internal Notes<textarea value={form.internalNotes} onChange={(event) => setForm({ ...form, internalNotes: event.target.value })} /></label>
          </>}
        </div>
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <button onClick={save}>Save Profile</button>
        </div>
      </div>
    </div>
  </div>;
}

function Tasks({ tasks, profiles, form, setForm, assign, updateTask, isLeadOrHr, selectedTaskUserId, onSelectUser, currentRole }: { tasks: TrainingTask[]; profiles: Profile[]; form: any; setForm: (value: any) => void; assign: () => void; updateTask: (id: string, status: TaskStatus) => void; isLeadOrHr: boolean; selectedTaskUserId: number | null; onSelectUser: (userId: number) => void; currentRole: Role }) {
  return <div className="stack">{isLeadOrHr && <div className="card stack"><h2>Assign Task</h2><div className="form-grid"><label>Developer<select value={form.assignedTo} onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name || profile.email}</option>)}</select></label><label>Title<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label>Priority<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>LOW</option><option>MEDIUM</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Due Date<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></label><label>Attachments<input value={form.attachments} onChange={(event) => setForm({ ...form, attachments: event.target.value })} /></label><label>Description<textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label></div><button onClick={assign}>Assign Task</button></div>}<div className="card"><div className="row" style={{ justifyContent: "space-between" }}><h2>Tasks</h2>{isLeadOrHr && <label style={{ minWidth: 260 }}>Developer<select value={selectedTaskUserId ?? ""} onChange={(event) => onSelectUser(Number(event.target.value))}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name || profile.email}</option>)}</select></label>}</div><table><thead><tr><th>Task</th><th>Priority</th><th>Due</th><th>Status</th><th>Action</th></tr></thead><tbody>{tasks.map((task) => {
    const actionOptions = getTaskStatusOptions(task.status, currentRole);
    const hasRealAction = actionOptions.some((status) => status !== task.status);

    return <tr key={task.id}><td><strong>{task.title}</strong><p>{task.description}</p>{task.attachments?.map((item) => <a key={item} href={item}>{item}</a>)}</td><td>{task.priority}</td><td>{task.dueDate?.slice(0, 10) || "TBD"}</td><td><span className={`badge ${task.status === "COMPLETED" ? "ok" : task.status === "NEEDS_REVISION" ? "warn" : "muted"}`}>{task.status}</span></td><td>{hasRealAction ? <select value={task.status} onChange={(event) => updateTask(task.id, event.target.value as TaskStatus)}>{actionOptions.map((status) => <option key={status}>{status}</option>)}</select> : <span className="status-chip muted">{task.status === "SUBMITTED" ? "Awaiting review" : task.status === "COMPLETED" ? "Finished" : "No action available"}</span>}</td></tr>;
  })}</tbody></table></div></div>;
}

function FeedbackPanel({ feedback, form, setForm, addFeedback, isLeadOrHr, profiles, selectedFeedbackUserId, onSelectUser, canCreateExternalFeedback, canCreateInternalFeedback }: { feedback: Feedback[]; form: any; setForm: (value: any) => void; addFeedback: () => void; isLeadOrHr: boolean; profiles: Profile[]; selectedFeedbackUserId: number | null; onSelectUser: (userId: number) => void; canCreateExternalFeedback: boolean; canCreateInternalFeedback: boolean }) {
  return <div className="stack">
    <div className="profile-hero">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="stack" style={{ gap: 10 }}>
          <p className="eyebrow">Review Notes</p>
          <h2>Feedback Workspace</h2>
          <p className="hero-note">
            Capture coaching notes, formal review comments, and restricted internal observations from one tidy workspace.
          </p>
        </div>
        {isLeadOrHr && <label style={{ minWidth: 280 }}>Developer<select value={selectedFeedbackUserId ?? ""} onChange={(event) => {
          const userId = Number(event.target.value);
          setForm({ ...form, developerId: String(userId) });
          onSelectUser(userId);
        }}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name || profile.email}</option>)}</select></label>}
      </div>
    </div>

    {(canCreateExternalFeedback || canCreateInternalFeedback) && <div className="card stack">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p className="eyebrow">Add Entry</p>
          <h2>Add Feedback</h2>
        </div>
        <span className="status-chip muted">Developer ID {selectedFeedbackUserId ?? form.developerId}</span>
      </div>

      <div className="feedback-compose">
        <label>
          Type
          <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FeedbackType })}>
            <option>EXTERNAL</option>
            {canCreateInternalFeedback && <option>INTERNAL</option>}
          </select>
        </label>

        <label className="feedback-compose-main">
          Feedback
          <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
        </label>
      </div>

      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button onClick={addFeedback}>Add Feedback</button>
      </div>
    </div>}

    <div className="grid">
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow">Visible to developer</p>
            <h2>External Feedback</h2>
          </div>
          <span className="status-chip accent">{feedback.filter((item) => item.type === "EXTERNAL").length}</span>
        </div>
        <div className="feedback-list">
          {feedback.filter((item) => item.type === "EXTERNAL").length === 0 && <div className="empty-state">No external feedback yet.</div>}
          {feedback.filter((item) => item.type === "EXTERNAL").map((item) => <div key={item.id} className="feedback-entry"><p>{item.content}</p></div>)}
        </div>
      </div>

      {isLeadOrHr && <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow">Restricted notes</p>
            <h2>Internal Feedback</h2>
          </div>
          <span className="status-chip">{feedback.filter((item) => item.type === "INTERNAL").length}</span>
        </div>
        <div className="feedback-list">
          {feedback.filter((item) => item.type === "INTERNAL").length === 0 && <div className="empty-state">No internal feedback yet.</div>}
          {feedback.filter((item) => item.type === "INTERNAL").map((item) => <div key={item.id} className="feedback-entry restricted"><p>{item.content}</p></div>)}
        </div>
      </div>}
    </div>
  </div>;
}

function Users({ profiles, inviteForm, setInviteForm, inviteUser, inviteLink, updateRole, resendInvite, deleteUser, currentUserId, canManageRoles }: { profiles: Profile[]; inviteForm: any; setInviteForm: (value: any) => void; inviteUser: () => void; inviteLink: string; updateRole: (userId: number, role: Role) => void; resendInvite: (profile: Profile) => void; deleteUser: (userId: number, userLabel: string) => void; currentUserId: number; canManageRoles: boolean }) {
  return (
    <div className="stack">
      <div className="profile-hero">
        <div className="stack" style={{ gap: 10 }}>
          <p className="eyebrow">Team Admin</p>
          <h2>User Management</h2>
          <p className="hero-note">
            Invite teammates, update roles, and keep account status visible without digging through a flat list.
          </p>
        </div>
      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow">Invite Flow</p>
            <h2>Invite User</h2>
          </div>
          <span className="status-chip accent">HR only</span>
        </div>
        <div className="form-grid">
          <label>Email<input value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} /></label>
          <label>Name<input value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} /></label>
          <label>Department<input value={inviteForm.department} onChange={(event) => setInviteForm({ ...inviteForm, department: event.target.value })} /></label>
          <label>Role<select value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value as Role })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        </div>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 16 }}>
          <button onClick={inviteUser}>Create Invite</button>
          {inviteLink && <div className="invite-link-box">{inviteLink}</div>}
        </div>
      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow">Accounts</p>
            <h2>Manage Users</h2>
          </div>
          <span className="status-chip muted">{profiles.length} users</span>
        </div>

        <div className="users-grid">
          {profiles.map((profile) => (
            <div key={profile.id} className="user-admin-card">
              <div className="user-admin-head">
                <div className="user-admin-avatar">
                  {(profile.name || profile.email).charAt(0).toUpperCase()}
                </div>
                <div className="stack" style={{ gap: 6 }}>
                  <h3>{profile.name || profile.email}</h3>
                  <p>{profile.email}</p>
                </div>
              </div>

              <div className="chip-row">
                <span className="status-chip">{profile.role}</span>
                <span className="status-chip muted">{profile.department || "No department"}</span>
                <span className={`status-chip ${profile.inviteExpiresAt ? "" : "accent"}`}>
                  {profile.inviteExpiresAt ? "Invite Pending" : "Active"}
                </span>
              </div>

              <div className="detail-list compact">
                <div>
                  <strong>Training Status</strong>
                  <span>{profile.trainingStatus || "NOT_STARTED"}</span>
                </div>
                <div>
                  <strong>Access</strong>
                  <span>{profile.inviteExpiresAt ? "Awaiting setup" : "Ready"}</span>
                </div>
              </div>

              <div className="user-admin-actions">
                <label>
                  Role
                  <select value={profile.role} onChange={(event) => updateRole(profile.id, event.target.value as Role)}>
                    {roles.map((role) => <option key={role}>{role}</option>)}
                  </select>
                </label>
                {profile.inviteExpiresAt && (
                  <button className="secondary" onClick={() => resendInvite(profile)}>
                    Resend Invite
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeleteUsersPanel() {
  return null;
}

function AuditTrailEnhanced({ logs, profiles }: { logs: AuditLog[]; profiles: Profile[] }) {
  const getPayload = (log: AuditLog) => (log.details || log.metadata || {}) as Record<string, any>;

  const getUserById = (id?: number | string) => {
    if (id === undefined || id === null) {
      return undefined;
    }

    const numericId = Number(id);
    if (Number.isNaN(numericId)) {
      return undefined;
    }

    return profiles.find((profile) => profile.id === numericId);
  };

  const formatActor = (log: AuditLog) => {
    const actor = getUserById(log.actorId);

    if (actor) {
      return {
        email: actor.email,
        id: actor.id,
        label: actor.name || actor.email,
      };
    }

    return log.actorId ? { email: "", id: log.actorId, label: `User ${log.actorId}` } : null;
  };

  const formatSubject = (log: AuditLog) => {
    if (log.entityType !== "users" || !log.entityId) {
      return null;
    }

    const subject = getUserById(log.entityId);

    if (subject) {
      return {
        email: subject.email,
        id: subject.id,
        label: subject.name || subject.email,
      };
    }

    return { email: "", id: log.entityId, label: `User ${log.entityId}` };
  };

  const describeChanges = (log: AuditLog) => {
    const payload = getPayload(log);

    if (payload.oldRole || payload.newRole) {
      return [`Role changed from ${payload.oldRole || "Unknown"} to ${payload.newRole || "Unknown"}`];
    }

    if (payload.oldStatus || payload.newStatus) {
      return [`Status moved from ${payload.oldStatus || "Unknown"} to ${payload.newStatus || "Unknown"}`];
    }

    if (payload.status) {
      return [`Status set to ${payload.status}`];
    }

    if (payload.fields && Array.isArray(payload.fields) && payload.fields.length) {
      return [`Updated fields: ${payload.fields.join(", ")}`];
    }

    if (payload.assignedTo || payload.title) {
      const assignedProfile = getUserById(payload.assignedTo);
      return [
        `Assigned "${payload.title || "task"}"${assignedProfile ? ` to ${assignedProfile.name || assignedProfile.email}` : ""}`,
      ];
    }

    if (payload.deletedEmail || payload.deletedRole) {
      return [`Deleted account ${payload.deletedEmail || ""}${payload.deletedRole ? ` (${payload.deletedRole})` : ""}`];
    }

    if (payload.email || payload.role || payload.inviteMode) {
      return [
        `${payload.inviteMode === "resent" ? "Invite resent" : "Invite created"}${payload.email ? ` for ${payload.email}` : ""}${payload.role ? ` as ${payload.role}` : ""}`,
      ];
    }

    return [];
  };

  const formatActionLabel = (action: string) => action.replaceAll("_", " ");

  return (
    <div className="stack">
      <div className="card stack">
        <div>
          <p className="eyebrow">Governance</p>
          <h2>Audit Log</h2>
          <p>See who made each change, who was affected, and the important details behind every update.</p>
        </div>
      </div>
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow">Activity Stream</p>
            <h2>Recent Events</h2>
          </div>
          <span className="status-chip muted">{logs.length} entries</span>
        </div>
        {logs.length === 0 && <p>No audit entries yet.</p>}
        <div className="audit-list">
          {logs.map((log) => {
            const actor = formatActor(log);
            const subject = formatSubject(log);
            const changes = describeChanges(log);

            return (
              <article key={log.id} className="audit-item">
                <div className="audit-item-top">
                  <div className="audit-chip-group">
                    <span className="status-chip accent">{formatActionLabel(log.action)}</span>
                    <span className="status-chip muted">{log.entityType}</span>
                  </div>
                  <span className="audit-time">{log.createdAt ? new Date(log.createdAt).toLocaleString() : "Unknown time"}</span>
                </div>
                <div className="audit-meta">
                  {actor && (
                    <div className="audit-person">
                      <span>Actor</span>
                      <strong>{actor.label}</strong>
                      <small>ID {actor.id}{actor.email ? ` · ${actor.email}` : ""}</small>
                    </div>
                  )}
                  {subject && (
                    <div className="audit-person">
                      <span>Affected User</span>
                      <strong>{subject.label}</strong>
                      <small>ID {subject.id}{subject.email ? ` · ${subject.email}` : ""}</small>
                    </div>
                  )}
                  {!subject && log.entityId && (
                    <div className="audit-person">
                      <span>Entity</span>
                      <strong>{log.entityType}</strong>
                      <small>ID {log.entityId}</small>
                    </div>
                  )}
                </div>
                {changes.length > 0 && (
                  <div className="audit-change-list">
                    {changes.map((change) => <p key={change}>{change}</p>)}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function UsersPageEnhanced({ profiles, inviteForm, setInviteForm, inviteUser, inviteLink, updateRole, resendInvite, deleteUser, currentUserId, canManageRoles }: { profiles: Profile[]; inviteForm: any; setInviteForm: (value: any) => void; inviteUser: () => void; inviteLink: string; updateRole: (userId: number, role: Role) => void; resendInvite: (profile: Profile) => void; deleteUser: (userId: number, userLabel: string) => void; currentUserId: number; canManageRoles: boolean }) {
  return (
    <div className="stack">
      <div className="card stack">
        <h2>Invite User</h2>
        <div className="form-grid">
          <label>Email<input value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} /></label>
          <label>Name<input value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} /></label>
          <label>Department<input value={inviteForm.department} onChange={(event) => setInviteForm({ ...inviteForm, department: event.target.value })} /></label>
          <label>Role<select value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value as Role })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label>
        </div>
        <button onClick={inviteUser}>Create Invite</button>
        {inviteLink && <p className="message">{inviteLink}</p>}
      </div>
      <div className="stack users-grid">
        {profiles.map((profile) => (
          <div key={profile.id} className="user-admin-card">
            <div className="user-admin-head">
              <div>
                <strong style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20 }}>{profile.name || profile.email}</strong>
                <p style={{ margin: "8px 0 0" }}>{profile.email}</p>
              </div>
              <div className="user-admin-actions">
                {canManageRoles ? (
                  <select value={profile.role} onChange={(event) => updateRole(profile.id, event.target.value as Role)}>
                    {roles.map((role) => <option key={role}>{role}</option>)}
                  </select>
                ) : (
                  <span className="status-chip muted">{profile.role}</span>
                )}
                {profile.inviteExpiresAt && <button className="secondary" onClick={() => resendInvite(profile)}>Resend Invite</button>}
                {profile.id !== currentUserId && (
                  <button className="icon-danger-button" aria-label={`Delete ${profile.name || profile.email}`} onClick={() => deleteUser(profile.id, profile.name || profile.email)} type="button">
                    🗑
                  </button>
                )}
              </div>
            </div>
            <div className="detail-list compact">
              <div>
                <span>Department</span>
                <strong>{profile.department || "No department"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{profile.trainingStatus || "NOT_STARTED"}</strong>
              </div>
              <div>
                <span>Access</span>
                <strong>{profile.inviteExpiresAt ? "Invite Pending" : "Active"}</strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function NotificationsCenter({ notifications, unread, markRead, markAllRead, openNotification }: { notifications: NotificationItem[]; unread: number; markRead: (id: string) => void; markAllRead: () => void; openNotification: (item: NotificationItem) => void | Promise<void> }) {
  return (
    <div className="stack">
      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2>Notifications</h2>
            <p style={{ margin: 0, color: "var(--text-body)" }}>
              {unread ? `${unread} unread notification${unread > 1 ? "s" : ""}` : "All caught up."}
            </p>
          </div>
          {unread > 0 && <button className="secondary" onClick={markAllRead}>Mark All Read</button>}
        </div>
      </div>
      <div className="stack">
        {notifications.length === 0 && <div className="card"><p>No notifications yet.</p></div>}
        {notifications.map((item) => (
          <div key={item.id} className="card" style={{ borderLeft: item.readAt ? "1px solid var(--stroke-soft)" : "4px solid var(--brand)" }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center", gap: 16 }}>
              <div className="stack" style={{ gap: 8 }}>
                <strong style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 20 }}>
                  {item.readAt ? "Viewed" : "New"}
                </strong>
                <p style={{ margin: 0 }}>{item.message}</p>
              </div>
              <div className="row" style={{ gap: 10 }}>
                {!item.readAt && (
                  <button className="secondary" onClick={() => markRead(item.id)}>
                    Mark Read
                  </button>
                )}
                <button className="secondary" onClick={() => openNotification(item)}>
                  Open
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Audit({ logs }: { logs: AuditLog[] }) {
  return (
    <div className="stack">
      <div className="profile-hero">
        <div className="stack" style={{ gap: 10 }}>
          <p className="eyebrow">Governance</p>
          <h2>Audit Log</h2>
          <p className="hero-note">
            Review important account, profile, feedback, and task activity in one clean timeline.
          </p>
        </div>
      </div>

      <div className="card stack">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p className="eyebrow">Activity Stream</p>
            <h2>Recent Events</h2>
          </div>
          <span className="status-chip muted">{logs.length} entries</span>
        </div>

        {logs.length === 0 && <div className="empty-state">No audit entries yet.</div>}

        <div className="audit-list">
          {logs.map((log) => (
            <div key={log.id} className="audit-item">
              <div className="audit-item-top">
                <span className="status-chip">{log.action.replaceAll("_", " ")}</span>
                <span className="audit-time">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : "Unknown time"}
                </span>
              </div>
              <div className="audit-meta">
                <strong>{log.entityType}</strong>
                <span>{log.entityId || "No entity id"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
