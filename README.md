

#  Auth System with MFA (Dockerized Full Stack)

A full-stack authentication application with **Multi-Factor Authentication (OTP)** built using a modern containerized architecture.

---

##  Features

*  User Registration & Login
*  OTP-based Multi-Factor Authentication
*  PostgreSQL Database
*  Dockerized (Frontend + Backend + DB)
*  One-command setup using Docker Compose

---

##  Project Structure

```
auth-project/
│
├── backend/        # Backend API (Node.js / Express)
├── frontend/       # Frontend (React)
├── db/
│   └── init.sql    # Database schema
├── docker-compose.yml
└── README.md
```

---

##  Prerequisites

Make sure you have installed:

* Docker
* Docker Compose

---

##  Docker Setup

###  Build & Run the Project

```bash
docker-compose up --build
```

This command will:

* Build frontend and backend containers
* Start PostgreSQL database
* Connect all services

---

###  Stop Containers

```bash
docker-compose down
```

---

###  Rebuild Containers

```bash
docker-compose up --build
```

---

###  View Logs

```bash
docker-compose logs -f
```

---

##  Services

###  PostgreSQL

* Port: `5432`
* Database: `authdb`
* User: `user`
* Password: `pass`
* Schema auto-loaded from `db/init.sql`

---

###  Backend

* URL: `http://localhost:5000`
* Handles authentication & OTP logic

Environment variables:

```
DB_HOST=db
DB_USER=user
DB_PASSWORD=pass
DB_NAME=authdb
```

---

###  Frontend

* URL: `http://localhost:3000`
* Communicates with backend API

Environment variable:

```
REACT_APP_API_URL=http://localhost:5000
```

---

##  Running the App

After starting Docker:

👉 Open: [http://localhost:3000](http://localhost:3000)

---

##  Application Flow

###  Authentication Flow

1. **Register**

   * User submits credentials
   * Stored in PostgreSQL

2. **Login**

   * Backend verifies credentials

3. **OTP Generation**

   * OTP is generated and sent (or simulated)

4. **OTP Verification**

   * User enters OTP
   * Access granted on success

---

##  Flow Overview

```
Frontend → Backend → Database
        → OTP → Verification → Login Success
```

---

##  Development Notes

* Backend connects to DB using Docker network
* DB initializes automatically on startup
* Services are isolated but connected via Docker Compose


