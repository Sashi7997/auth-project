CREATE TYPE "Role" AS ENUM ('JUNIOR_DEV', 'SENIOR_DEV', 'TEAM_LEAD', 'HR');
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE TYPE "TrainingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'ON_HOLD', 'COMPLETED', 'FAILED');
CREATE TYPE "TaskStatus" AS ENUM ('ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'REVIEWED', 'NEEDS_REVISION', 'COMPLETED');
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE "FeedbackType" AS ENUM ('EXTERNAL', 'INTERNAL');

CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT,
  "email" TEXT NOT NULL UNIQUE,
  "password" TEXT NOT NULL,
  "mfa_secret" TEXT,
  "role" "Role" NOT NULL DEFAULT 'JUNIOR_DEV',
  "department" TEXT,
  "photo_url" TEXT,
  "github_url" TEXT,
  "linkedin_url" TEXT,
  "skills" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "training_status" "TrainingStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "training_start_date" TIMESTAMP(3),
  "training_end_date" TIMESTAMP(3),
  "join_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "internal_notes" TEXT,
  "invite_token" TEXT UNIQUE,
  "invite_expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "tasks" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
  "status" "TaskStatus" NOT NULL DEFAULT 'ASSIGNED',
  "due_date" TIMESTAMP(3),
  "attachments" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "assigned_to" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "assigned_by" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "feedback" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "content" TEXT NOT NULL,
  "type" "FeedbackType" NOT NULL,
  "developer_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "author_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "notifications" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "message" TEXT NOT NULL,
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "audit_logs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  "actor_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT,
  "details" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
