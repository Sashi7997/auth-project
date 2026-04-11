import { Router, Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { pool } from "../db";

const router = Router();

/**
 * REGISTER
 */
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const secret = speakeasy.generateSecret();

    await pool.query(
      "INSERT INTO users (email, password, mfa_secret) VALUES ($1, $2, $3)",
      [email, hashedPassword, secret.base32]
    );

    const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

    res.json({
      message: "User registered",
      qrCode,
    });
  } catch (error: any) {
    if (error.code === "23505") {
      return res.status(400).json({ message: "Email already exists" });
    }

    console.error(error);
    res.status(500).json({ message: "Error registering user" });
  }
});

/**
 * LOGIN (STEP 1)
 */
router.post("/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    res.json({
      message: "Password verified, enter OTP",
      email,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error logging in" });
  }
});

/**
 * VERIFY OTP (STEP 2)
 */
router.post("/verify-otp", async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const verified = speakeasy.totp.verify({
      secret: user.mfa_secret,
      encoding: "base32",
      token: otp,
      window: 1,
    });

    if (!verified) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const token = jwt.sign({ email }, "secret", { expiresIn: "1h" });

    res.json({
      message: "Login successful",
      token,
    });
  } catch (error: any) {
    console.error(error);
    res.status(500).json({ message: "Error verifying OTP" });
  }
});

export default router;