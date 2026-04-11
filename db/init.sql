-- Initialize database schema for auth-project

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  mfa_secret VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);
