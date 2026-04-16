import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const cookieToken = req.headers.cookie
    ?.split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith("token="))
    ?.split("=")[1];

  if (!authHeader && !cookieToken) {
    res.status(401).json({ message: "No token provided" });
    return;
  }

  const token = authHeader ? authHeader.split(" ")[1] : cookieToken;

  try {
    const decoded = jwt.verify(token || "", process.env.JWT_SECRET || "dev-secret");
    (req as any).user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: "Invalid token" });
  }
};
