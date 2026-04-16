require("dotenv").config({ path: require("path").join(__dirname, "..", "backend", ".env") });

const { Pool } = require("pg");

const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : new Pool({
      user: process.env.DB_USER || "user",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "authdb",
      password: process.env.DB_PASSWORD || "pass",
      port: Number(process.env.DB_PORT || 5432),
    });

const quoteType = (row) => {
  if (row.udt_name === "int4") return "INTEGER";
  if (row.udt_name === "int8") return "BIGINT";
  if (row.udt_name === "uuid") return "UUID";
  if (row.data_type === "character varying") return `VARCHAR(${row.character_maximum_length || 255})`;
  if (row.data_type === "text") return "TEXT";

  return row.udt_name;
};

const getColumnType = async (tableName, columnName) => {
  const result = await pool.query(
    `SELECT data_type, udt_name, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [tableName, columnName]
  );

  return result.rows[0] ? quoteType(result.rows[0]) : null;
};

const tableRowCount = async (tableName) => {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM ${tableName}`);
  return result.rows[0].count;
};

const repairTrackerTablesIfNeeded = async (userIdType) => {
  const trackedColumns = [
    ["tasks", "assigned_to"],
    ["feedback", "developer_id"],
    ["notifications", "user_id"],
    ["audit_logs", "actor_id"],
  ];

  const mismatches = [];

  for (const [tableName, columnName] of trackedColumns) {
    const columnType = await getColumnType(tableName, columnName);

    if (columnType && columnType !== userIdType) {
      mismatches.push({ tableName, columnName, columnType });
    }
  }

  if (mismatches.length === 0) {
    return;
  }

  const trackerTables = ["tasks", "feedback", "notifications", "audit_logs"];
  const nonEmptyTables = [];

  for (const tableName of trackerTables) {
    const idType = await getColumnType(tableName, "id");

    if (idType) {
      const count = await tableRowCount(tableName);

      if (count > 0) {
        nonEmptyTables.push(`${tableName} (${count} rows)`);
      }
    }
  }

  if (nonEmptyTables.length > 0) {
    throw new Error(
      `Tracker tables have mismatched user id types and are not empty: ${nonEmptyTables.join(
        ", "
      )}. Back up or manually migrate these tables before running setup again.`
    );
  }

  console.log("Repairing empty tracker tables with the correct users.id type...");
  await pool.query("DROP TABLE IF EXISTS audit_logs, notifications, feedback, tasks");
};

const buildSchema = (userIdType) => `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'JUNIOR_DEV',
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  ADD COLUMN IF NOT EXISTS photo_url TEXT,
  ADD COLUMN IF NOT EXISTS github_url TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS skills TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS training_status VARCHAR(20) DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS internal_notes TEXT,
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS join_date TIMESTAMP DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now(),
  ADD COLUMN IF NOT EXISTS training_start_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS training_end_date TIMESTAMP,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  assigned_to ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
  assigned_by ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
  priority VARCHAR(20) DEFAULT 'MEDIUM',
  status VARCHAR(20) DEFAULT 'ASSIGNED',
  attachments TEXT[] DEFAULT '{}',
  due_date DATE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS attachments TEXT[] DEFAULT '{}';

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  type VARCHAR(10) NOT NULL CHECK (type IN ('EXTERNAL', 'INTERNAL')),
  developer_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
  author_id ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id ${userIdType} REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id ${userIdType} REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);
`;

const freshSchema = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('JUNIOR_DEV', 'SENIOR_DEV', 'TEAM_LEAD', 'HR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TrainingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED', 'NEEDS_REVISION', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FeedbackType" AS ENUM ('EXTERNAL', 'INTERNAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name TEXT,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  mfa_secret TEXT,
  role "Role" NOT NULL DEFAULT 'JUNIOR_DEV',
  department TEXT,
  photo_url TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  skills TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  training_status "TrainingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  training_start_date TIMESTAMP,
  training_end_date TIMESTAMP,
  join_date TIMESTAMP NOT NULL DEFAULT now(),
  internal_notes TEXT,
  invite_token TEXT UNIQUE,
  invite_expires_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority "Priority" NOT NULL DEFAULT 'MEDIUM',
  status "TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
  due_date TIMESTAMP,
  attachments TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  assigned_to INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  content TEXT NOT NULL,
  type "FeedbackType" NOT NULL,
  developer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  read_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  actor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
`;

const run = async () => {
  const result = await pool.query(
    `SELECT data_type, udt_name, character_maximum_length
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'users'
       AND column_name = 'id'`
  );

  if (!result.rows[0]) {
    await pool.query(freshSchema);
    console.log("Fresh training tracker schema applied successfully with Prisma-compatible tables.");
    return;
  }

  const userIdType = quoteType(result.rows[0]);
  await repairTrackerTablesIfNeeded(userIdType);
  await pool.query(buildSchema(userIdType));

  console.log(`Training tracker schema applied successfully with users.id type ${userIdType}.`);
};

run()
  .catch((error) => {
    console.error("Failed to apply training tracker schema.");
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
