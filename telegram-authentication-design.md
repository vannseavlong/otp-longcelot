# Reusable Telegram-Based Authentication System (Design Document)

## 1. Overview

This document describes a reusable authentication system designed to work across multiple projects, backend languages, and infrastructures. The core goal is simple (and honestly very practical): **eliminate third-party OTP costs** by using **Telegram bots** as the OTP delivery channel, while keeping security strong and the system flexible enough to scale.

Each project integrates the same authentication logic and database schema, but **uses its own Telegram bot token**, avoiding shared bottlenecks, rate-limit issues, and single-point failures.

This system focuses strictly on **authentication**, not authorization. Role-Based Access Control (RBAC) is intentionally left out and delegated to each individual project.

---

## 2. Goals & Non-Goals

### 2.1 Goals

- Provide a **reusable authentication flow** usable by any backend language  
- Remove dependency on paid OTP providers (SMS, email OTP services)  
- Use **Telegram bots as the OTP delivery mechanism**  
- Allow users to securely link, verify, and change their Telegram accounts  
- Keep credentials stored **inside each project’s own database**  
- Support high concurrency by allowing **one bot per project**  
- Remain scalable, secure, and framework-agnostic  

### 2.2 Non-Goals

- This system does **not** manage roles, permissions, or access control  
- This system does **not** act as a centralized identity provider (not OAuth / SSO)  
- This system does **not** store user data centrally across projects  

---

## 3. High-Level Architecture

Each project integrates:

- The **Authentication Module** (shared logic / spec)  
- Its **own database** (credential tables predefined by this spec)  
- Its **own Telegram Bot** (unique bot token)  

```
User ──▶ Project Backend ──▶ Project Database
   │           │
   │           └──▶ Telegram Bot API (project-specific)
   │
   └──▶ Telegram App
```

There is **no shared backend** between projects. Only the *design* is shared.

---

## 4. Authentication Flow

### 4.1 User Registration

1. User provides:
   - Email
   - Username
   - Password

2. Backend:
   - Hashes password (bcrypt / argon2 recommended)
   - Creates a user record in the project database
   - Marks Telegram as **not yet linked**

3. User is instructed to:
   - Open the project’s Telegram bot
   - Click **Start** (or send `/start`)

---

### 4.2 Telegram Linking Flow

1. When the user starts the bot:
   - Telegram provides `chat_id` and basic metadata

2. Backend verifies ownership using one of the following:
   - One-time linking code shown in the web/app UI
   - Or deep-link payload (`/start <token>`)

3. On successful verification:
   - Telegram `chat_id` is bound to the user
   - Telegram status becomes **verified**

---

### 4.3 Login Flow (Email / Username + OTP)

1. User enters:
   - Email or username
   - Password

2. Backend:
   - Validates password
   - Generates a **short-lived OTP** (e.g. 6 digits, 60–120s TTL)
   - Sends OTP to the linked Telegram chat

3. User enters OTP

4. Backend:
   - Verifies OTP
   - Issues session / JWT / access token

> From this point onward, **all OTP challenges are delivered via Telegram**.

---

### 4.4 OTP Usage Scenarios

Telegram-based OTP can be used for:

- Login verification
- Sensitive actions (change password, update email)
- Telegram account changes
- Account recovery flows

---

### 4.5 Changing Telegram Account

#### While Logged In

1. User requests Telegram change
2. Backend:
   - Sends OTP to **current Telegram**
   - Verifies request
3. User links a new Telegram account
4. Old Telegram binding is revoked

#### While Logged Out (Recovery Flow)

1. User provides:
   - Email / username
   - Recovery code

2. If valid:
   - User is allowed to re-link a new Telegram account

---

## 5. Recovery Codes

Recovery codes are critical for Telegram loss scenarios.

- Generated during first Telegram linking
- Single-use
- Stored hashed in the database
- User is responsible for storing them securely

Example:
```
RC-9F3A-KQ21
RC-7L2M-P8ZD
```

---

## 6. Database Design (Predefined but Extensible)

### 6.1 Users Table (Core)

```sql
users (
  id UUID / BIGINT PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  username VARCHAR UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

### 6.2 Telegram Credentials Table

```sql
telegram_credentials (
  id UUID / BIGINT PRIMARY KEY,
  user_id FOREIGN KEY REFERENCES users(id),
  telegram_chat_id VARCHAR UNIQUE,
  telegram_username VARCHAR,
  is_verified BOOLEAN DEFAULT false,
  linked_at TIMESTAMP
)
```

### 6.3 OTP Table (Ephemeral)

```sql
otp_requests (
  id UUID / BIGINT PRIMARY KEY,
  user_id FOREIGN KEY REFERENCES users(id),
  otp_hash TEXT,
  expires_at TIMESTAMP,
  used BOOLEAN DEFAULT false
)
```

### 6.4 Recovery Codes Table

```sql
recovery_codes (
  id UUID / BIGINT PRIMARY KEY,
  user_id FOREIGN KEY REFERENCES users(id),
  code_hash TEXT,
  used BOOLEAN DEFAULT false
)
```

---

## 7. Security Considerations

- Passwords **must never** be stored in plain text
- OTPs must be:
  - Random
  - Short-lived
  - Hashed at rest
- Telegram bot tokens must be:
  - Stored as environment variables
  - Rotatable per project
- Rate limiting on:
  - Login attempts
  - OTP requests
  - Telegram linking attempts
- All sensitive operations must require OTP verification

---

## 8. Telegram Bot Strategy (Per Project)

Each project:

- Registers **its own Telegram bot**
- Injects the bot token via configuration
- Handles webhook or polling independently

Benefits:

- No shared rate limits
- No global downtime
- Easier debugging per project
- Clear ownership boundaries

---

## 9. Language & Framework Agnostic Design

This authentication system:

- Does not rely on any specific backend language
- Can be implemented in:
  - Node.js
  - Java
  - Python
  - Go
  - PHP
- Uses standard concepts:
  - REST / RPC
  - Database tables
  - HTTP + Telegram Bot API

---

## 10. RBAC Consideration (Explicitly Excluded)

RBAC is **intentionally excluded** from this authentication system.

Reasoning:

- Roles differ drastically between projects
- Mixing authentication and authorization increases coupling
- This system’s mission is **identity verification**, not permission management

Recommended approach:

- Each project implements its own RBAC layer
- RBAC tables reference the `users.id` from this system

---

## 11. Future Extensions (Optional)

- Telegram message signing verification
- Multi-device session management
- WebAuthn / passkey fallback
- Admin-side audit logs

---

## 12. Summary

This authentication system provides:

- A cost-effective OTP alternative
- Strong security guarantees
- High scalability
- Clean separation of concerns
- Maximum flexibility across projects

It does one thing well: **prove the user is who they say they are**, using Telegram as a trusted delivery channel — and then gets out of the way.
