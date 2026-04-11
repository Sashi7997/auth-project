import { Pool } from "pg";

export const pool = new Pool({
  user: process.env.DB_USER || "user",
  // Default to localhost for local development; override with DB_HOST in Docker
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "authdb",
  password: process.env.DB_PASSWORD || "pass",
  port: 5432,
});