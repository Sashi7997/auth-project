export type AppPage = "auth" | "dashboard" | "profile" | "tasks" | "feedback" | "users" | "audit";

type NavbarProps = {
  currentPage?: AppPage;
  notifications?: number;
  onNavigate?: (page: AppPage) => void;
  showAudit?: boolean;
  showUsers?: boolean;
};

export default function Navbar({
  currentPage = "dashboard",
  notifications = 0,
  onNavigate,
  showAudit = false,
  showUsers = false,
}: NavbarProps) {
  const navigate = (page: AppPage) => {
    if (onNavigate) {
      onNavigate(page);
      return;
    }

    window.location.hash = page;
  };

  const buttonStyle = (page: AppPage) => ({
    background: currentPage === page ? "#ffffff" : "transparent",
    color: currentPage === page ? "#111111" : "#ffffff",
    border: "1px solid #ffffff",
    borderRadius: 6,
    padding: "8px 10px",
    cursor: "pointer",
  });

  return (
    <nav
      style={{
        alignItems: "center",
        background: "#111111",
        color: "#ffffff",
        display: "flex",
        justifyContent: "space-between",
        padding: 16,
      }}
    >
      <h1 style={{ fontSize: 20, margin: 0 }}>Training Tracker</h1>

      <div style={{ alignItems: "center", display: "flex", gap: 10 }}>
        <button style={buttonStyle("dashboard")} onClick={() => navigate("dashboard")}>
          Dashboard
        </button>
        <button style={buttonStyle("profile")} onClick={() => navigate("profile")}>
          Profile
        </button>
        <button style={buttonStyle("tasks")} onClick={() => navigate("tasks")}>
          Tasks
        </button>
        <button style={buttonStyle("feedback")} onClick={() => navigate("feedback")}>
          Feedback
        </button>
        {showUsers && (
          <button style={buttonStyle("users")} onClick={() => navigate("users")}>
            Users
          </button>
        )}
        {showAudit && (
          <button style={buttonStyle("audit")} onClick={() => navigate("audit")}>
            Audit
          </button>
        )}
        <span>Notifications: {notifications}</span>
        <button
          style={{
            background: "#b00020",
            border: 0,
            borderRadius: 6,
            color: "#ffffff",
            cursor: "pointer",
            padding: "8px 10px",
          }}
          onClick={() => {
            localStorage.removeItem("token");
            navigate("auth");
          }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
