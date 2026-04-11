import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth";

const app = express();

// Allow frontend (development) to call this API
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

app.get("/", (req, res) => {
  res.send("Backend running 🚀");
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});