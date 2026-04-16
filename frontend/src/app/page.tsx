"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/api";

type Role = "JUNIOR_DEV" | "SENIOR_DEV" | "TEAM_LEAD" | "HR";
type Page = "dashboard" | "profile" | "tasks" | "feedback" | "notifications" | "users" | "audit";
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
  createdAt?: string;
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
  const [page, setPage] = useState<Page>("dashboard");
  const [authMode, setAuthMode] = useState<"login" | "register" | "setup">("login");
  const [step, setStep] = useState<"password" | "otp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [registerRole, setRegisterRole] = useState<Role>("JUNIOR_DEV");
  const [otp, setOtp] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [tasks, setTasks] = useState<TrainingTask[]>([]);
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
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

  const switchAuthMode = (mode: "login" | "register") => {
    setAuthMode(mode);
    setStep("password");
    setQrCode("");
    setMessage("");
    setSessionExpired(false);
  };

  const isLeadOrHr = profile?.role === "HR" || profile?.role === "TEAM_LEAD";
  const isHr = profile?.role === "HR";
  const canCreateExternalFeedback = profile ? canAddExternalFeedback(profile.role) : false;
  const canCreateInternalFeedback = profile ? canAddInternalFeedback(profile.role) : false;
  const completeTasks = tasks.filter((task) => task.status === "COMPLETED").length;
  const progress = tasks.length ? Math.round((completeTasks / tasks.length) * 100) : 0;
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

  const loadData = async () => {
    try {
      const profileResponse = await api.get<Profile>("/profile");
      const current = profileResponse.data;
      setProfile(current);
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

      if (current.role === "HR" || current.role === "TEAM_LEAD") {
        const profileList = await api.get<Profile[]>("/profile/all");
        const auditResponse = await api.get<AuditLog[]>("/audit");
        setProfiles(profileList.data);
        setAuditLogs(auditResponse.data);
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
      return;
    }

    api
      .get<{ user: Profile }>("/auth/me")
      .then(() => loadData())
      .catch(() => undefined);
  }, []);

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
      setMessage("Profile setup complete. Scan the QR code, then log in.");
      setAuthMode("login");
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
    await resetSession("Logged out.");
  };

  if (!profile) {
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
              <label>Full Name<input value={profileForm.name} onChange={(event) => setProfileForm({ ...profileForm, name: event.target.value })} /></label>
              <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
              <label>Skills<input value={profileForm.skills} onChange={(event) => setProfileForm({ ...profileForm, skills: event.target.value })} /></label>
              <label>GitHub URL<input value={profileForm.githubUrl} onChange={(event) => setProfileForm({ ...profileForm, githubUrl: event.target.value })} /></label>
              <label>LinkedIn URL<input value={profileForm.linkedinUrl} onChange={(event) => setProfileForm({ ...profileForm, linkedinUrl: event.target.value })} /></label>
              <button onClick={setupProfile}>Finish Setup</button>
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
          {qrCode && authMode !== "login" && <img src={qrCode} alt="Authenticator QR code" style={{ maxWidth: 220 }} />}
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
        <nav className="nav">
          {(["dashboard", "profile", "tasks", "feedback", "notifications"] as Page[]).map((item) => (
            <button key={item} className={page === item ? "active" : ""} onClick={() => setPage(item)}>
              {item === "notifications" ? `Notifications${unread ? ` (${unread})` : ""}` : item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
          {isHr && <button className={page === "users" ? "active" : ""} onClick={() => setPage("users")}>Users</button>}
          {isLeadOrHr && <button className={page === "audit" ? "active" : ""} onClick={() => setPage("audit")}>Audit</button>}
          <button className="danger" onClick={logout}>Logout</button>
        </nav>
      </header>
      <section className="workspace">
        {message && <p className="message">{message}</p>}
        {page === "dashboard" && <Dashboard progress={progress} tasks={tasks} notifications={notifications} profiles={filteredProfiles} markRead={markRead} isLeadOrHr={Boolean(isLeadOrHr)} filters={dashboardFilters} setFilters={setDashboardFilters} departments={departmentOptions} />}
        {page === "profile" && <ProfileEditor form={profileForm} setForm={setProfileForm} save={saveProfile} isLeadOrHr={Boolean(isLeadOrHr)} profiles={profiles} selectedProfileId={selectedProfileId} onSelectProfile={loadProfileForEditor} currentProfile={profiles.find((item) => item.id === selectedProfileId) || profile} />}
        {page === "tasks" && <Tasks tasks={tasks} profiles={profiles} form={taskForm} setForm={setTaskForm} assign={assignTask} updateTask={updateTask} isLeadOrHr={Boolean(isLeadOrHr)} selectedTaskUserId={selectedTaskUserId} onSelectUser={loadTasksForUser} currentRole={profile.role} />}
        {page === "feedback" && <FeedbackPanel feedback={feedback} form={feedbackForm} setForm={setFeedbackForm} addFeedback={addFeedback} isLeadOrHr={Boolean(isLeadOrHr)} profiles={profiles} selectedFeedbackUserId={selectedFeedbackUserId} onSelectUser={loadFeedbackForUser} canCreateExternalFeedback={canCreateExternalFeedback} canCreateInternalFeedback={canCreateInternalFeedback} />}
        {page === "notifications" && <NotificationsCenter notifications={notifications} unread={unread} markRead={markRead} markAllRead={markAllNotificationsRead} openNotification={openNotification} />}
        {page === "users" && <Users profiles={profiles} inviteForm={inviteForm} setInviteForm={setInviteForm} inviteUser={inviteUser} inviteLink={inviteLink} updateRole={updateRole} resendInvite={resendInvite} />}
        {page === "audit" && <Audit logs={auditLogs} />}
      </section>
    </main>
  );
}

function Dashboard({ progress, tasks, notifications, profiles, markRead, isLeadOrHr, filters, setFilters, departments }: { progress: number; tasks: TrainingTask[]; notifications: NotificationItem[]; profiles: Profile[]; markRead: (id: string) => void; isLeadOrHr: boolean; filters: { department: string; role: string; status: string }; setFilters: (value: { department: string; role: string; status: string }) => void; departments: string[] }) {
  return (
    <div className="stack">
      <section className="banner">
        <div className="banner-copy">
          <h1>Training Dashboard</h1>
        </div>
        <img src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80" alt="Planning board" />
      </section>
      <div className="grid">
        <div className="card"><h3>Progress</h3><strong>{progress}%</strong><progress max={100} value={progress} style={{ width: "100%" }} /></div>
        <div className="card"><h3>Pending Review</h3><strong>{tasks.filter((task) => task.status === "SUBMITTED").length}</strong></div>
        <div className="card"><h3>Overdue Tasks</h3><strong>{tasks.filter((task) => task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "COMPLETED").length}</strong></div>
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
  return <div className="stack">{(canCreateExternalFeedback || canCreateInternalFeedback) && <div className="card stack"><div className="row" style={{ justifyContent: "space-between" }}><h2>Add Feedback</h2>{isLeadOrHr && <label style={{ minWidth: 260 }}>Developer<select value={selectedFeedbackUserId ?? ""} onChange={(event) => {
    const userId = Number(event.target.value);
    setForm({ ...form, developerId: String(userId) });
    onSelectUser(userId);
  }}>{profiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.name || profile.email}</option>)}</select></label>}</div><div className="form-grid"><label>Developer ID<input value={selectedFeedbackUserId ?? form.developerId} readOnly /></label><label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as FeedbackType })}><option>EXTERNAL</option>{canCreateInternalFeedback && <option>INTERNAL</option>}</select></label><label>Feedback<textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label></div><button onClick={addFeedback}>Add Feedback</button></div>}<div className="grid"><div className="card"><h2>External Feedback</h2>{feedback.filter((item) => item.type === "EXTERNAL").map((item) => <p key={item.id}>{item.content}</p>)}</div>{isLeadOrHr && <div className="card"><h2>Internal Feedback</h2>{feedback.filter((item) => item.type === "INTERNAL").map((item) => <p key={item.id}>{item.content}</p>)}</div>}</div></div>;
}

function Users({ profiles, inviteForm, setInviteForm, inviteUser, inviteLink, updateRole, resendInvite }: { profiles: Profile[]; inviteForm: any; setInviteForm: (value: any) => void; inviteUser: () => void; inviteLink: string; updateRole: (userId: number, role: Role) => void; resendInvite: (profile: Profile) => void }) {
  return <div className="stack"><div className="card stack"><h2>Invite User</h2><div className="form-grid"><label>Email<input value={inviteForm.email} onChange={(event) => setInviteForm({ ...inviteForm, email: event.target.value })} /></label><label>Name<input value={inviteForm.name} onChange={(event) => setInviteForm({ ...inviteForm, name: event.target.value })} /></label><label>Department<input value={inviteForm.department} onChange={(event) => setInviteForm({ ...inviteForm, department: event.target.value })} /></label><label>Role<select value={inviteForm.role} onChange={(event) => setInviteForm({ ...inviteForm, role: event.target.value as Role })}>{roles.map((role) => <option key={role}>{role}</option>)}</select></label></div><button onClick={inviteUser}>Create Invite</button>{inviteLink && <p className="message">{inviteLink}</p>}</div><div className="card"><h2>Manage Users</h2>{profiles.map((profile) => <div key={profile.id} className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid var(--line)", paddingBottom: 12, marginBottom: 12 }}><div><strong style={{ fontFamily: "Space Grotesk, sans-serif", fontSize: 18 }}>{profile.name || profile.email}</strong><p>{profile.email}</p><p>{profile.department || "No department"} · {profile.trainingStatus || "NOT_STARTED"} · {profile.inviteExpiresAt ? "Invite Pending" : "Active"}</p></div><div className="row"><select value={profile.role} onChange={(event) => updateRole(profile.id, event.target.value as Role)}>{roles.map((role) => <option key={role}>{role}</option>)}</select>{profile.inviteExpiresAt && <button className="secondary" onClick={() => resendInvite(profile)}>Resend Invite</button>}</div></div>)}</div></div>;
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
  return <div className="card"><h2>Audit Log</h2>{logs.length === 0 && <p>No audit entries yet.</p>}{logs.map((log) => <p key={log.id}>{log.createdAt} · {log.action} · {log.entityType} {log.entityId}</p>)}</div>;
}
