import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";
import profileRoutes from "./routes/profile";
import taskRoutes from "./routes/tasks";
import feedbackRoutes from "./routes/feedback";
import notificationRoutes from "./routes/notifications";
import auditRoutes from "./routes/audit";

const app = express();

app.use(
  cors({
    credentials: true,
    origin: "http://localhost:3000",
  })
);
app.use(express.json({ limit: "10mb" }));

app.use("/auth", authRoutes);
app.use("/profile", profileRoutes);
app.use("/tasks", taskRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/notifications", notificationRoutes);
app.use("/audit", auditRoutes);

app.get("/", (_req, res) => {
  res.send("Backend running");
});

app.listen(5000, "0.0.0.0", () => {
  console.log("Server running on port 5000");
});
