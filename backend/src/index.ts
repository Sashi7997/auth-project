import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";

const app = express();

app.use(cors()); // MUST
app.use(express.json());

app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.listen(5000, "0.0.0.0", () => {   // 🔥 IMPORTANT CHANGE
  console.log("Server running on port 5000");
});