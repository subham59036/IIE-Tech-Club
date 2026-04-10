# TechOS — IIE Tech Club Management System

> A full-stack club attendance and management platform built with **Next.js 15**, **TypeScript**, **Turso (libSQL)**, and **Tailwind CSS v4**. Deployed on **Vercel**.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Quick Start](#quick-start)
5. [Environment Variables](#environment-variables)
6. [Database Setup](#database-setup)
7. [First Admin Account](#first-admin-account)
8. [Deploying to Vercel](#deploying-to-vercel)
9. [Cron Job (Auto Cleanup)](#cron-job)
10. [ID Format Rules](#id-format-rules)
11. [Event Registration Form](#event-registration-form)
12. [Customisation Guide](#customisation-guide)
13. [Security Notes](#security-notes)
14. [Troubleshooting](#troubleshooting)

---

## Features

### Admin Dashboard (8 tabs)
| Tab | Description |
|---|---|
| **Admins** | Add, edit, and remove admin accounts |
| **Students** | Add, edit, and remove student accounts |
| **Attendance** | Calendar grid — click any cell to toggle Present/Absent per student per day |
| **Chart** | Interactive bar chart of monthly attendance + PDF leaderboard report download |
| **Announcements** | Post announcements with title, description, and announced date |
| **Events** | Create, pause, edit deadline, delete events — generate and share a public form link |
| **Notifications** | System notifications (who added/removed whom, event changes, etc.) |
| **Profile** | Edit own name, ID, and password |

### Student Dashboard (5 tabs)
| Tab | Description |
|---|---|
| **Attendance** | View monthly bar chart of all students' attendance |
| **Announcements** | Read-only announcement feed |
| **Events** | Read-only current event info |
| **Notifications** | Personal notifications (added/removed, welcome messages) |
| **Profile** | Edit own name, ID, password + monthly attendance calendar with present/absent dates |

### Public Event Form
- Shareable URL: `https://your-app.vercel.app/event/<token>`
- Works for external (non-member) students
- Math captcha + per-IP rate limiting (3 attempts / hour)
- Duplicate roll-number detection per event
- Admins can pause/resume from the Events tab

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.7 |
| Database | Turso (libSQL / SQLite at the edge) |
| Auth | `jose` JWT — httpOnly cookies |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| PDF | jsPDF + jspdf-autotable (lazy-loaded client-side) |
| Passwords | bcryptjs (bcrypt cost 12) |
| Deployment | Vercel (Serverless + Edge Middleware) |

---

## Project Structure

```
src/
├── middleware.ts               # Edge JWT guard for /admin/* and /student/*
├── types/index.ts              # All shared TypeScript interfaces
├── lib/
│   ├── auth.ts                 # JWT create/verify, cookie helpers
│   ├── db.ts                   # Turso client, full schema, DB helpers
│   └── utils.ts                # ID validation, captcha, IP hashing, dates
├── app/
│   ├── page.tsx                # Login page (both roles)
│   ├── layout.tsx              # Root layout + Google Fonts
│   ├── globals.css             # Tailwind v4 + dark theme CSS variables
│   ├── admin/                  # Admin dashboard (server guard + client page)
│   ├── student/                # Student dashboard
│   ├── event/[token]/          # Public event registration form
│   └── api/                    # All API routes (15 endpoints)
└── components/
    ├── ui/                     # Button, Modal, Popup, TabBar
    ├── admin/                  # 7 admin tab components
    ├── shared/                 # AttendanceChart (used by both roles)
    └── student/                # 4 student tab components
```

---

## Quick Start

### Prerequisites
- Node.js ≥ 20
- A [Vercel](https://vercel.com) account
- A [Turso](https://turso.tech) database (free tier works)

### 1. Clone / download

```bash
# If starting from the archive:
tar -xzf techos.tar.gz
cd techos

# Or clone from your own repo:
git clone https://github.com/YOUR_USERNAME/techos.git
cd techos
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.local.example .env.local
```

Fill in `.env.local` — see [Environment Variables](#environment-variables) below.

### 4. Initialise the database

```bash
npm run db:init
```

This creates all 10 tables and indexes in your Turso database.

### 5. Create the first admin

In the [Turso dashboard](https://app.turso.tech) shell, or using the Turso CLI:

```sql
INSERT INTO admins (name, admin_id) VALUES ('Your Name', 'A001');
```

Then open `http://localhost:3000`, log in with ID `A001` and any password — that password becomes permanent.

### 6. Run locally

```bash
npm run dev
```

Open `http://localhost:3000`.

---

## Environment Variables

Copy `.env.local.example` → `.env.local` and fill in:

| Variable | Required | How to get it |
|---|---|---|
| `TURSO_DATABASE_URL` | ✅ | Vercel → Integrations → Turso → `vercel env pull` |
| `TURSO_AUTH_TOKEN` | ✅ | Same as above |
| `JWT_SECRET` | ✅ | Run: `openssl rand -hex 64` |
| `CRON_SECRET` | ✅ | Any random string (e.g. `openssl rand -hex 32`) |
| `IP_SALT` | ✅ | Any random string (protects IP hashing) |
| `NEXT_PUBLIC_APP_URL` | ✅ | Your Vercel domain, e.g. `https://techos.vercel.app` |

> **Never commit `.env.local` to Git.** It is already in `.gitignore`.

---

## Database Setup

The database is initialised once with:

```bash
npm run db:init
```

### Tables created

| Table | Purpose |
|---|---|
| `admins` | Admin accounts (name, ID, password hash) |
| `students` | Student accounts |
| `attendance` | One record per student per day (present/absent) |
| `announcements` | Club announcements |
| `events` | One active event at a time |
| `event_registrations` | Form submissions per event |
| `admin_notifications` | Audit trail visible to all admins |
| `student_notifications` | Per-student messages |
| `rate_limits` | IP-based rate limiting for event registration |
| `captcha_tokens` | Short-lived math captcha tokens |

### Auto-cleanup policy (runs daily at 02:00 UTC)

| Data | Deleted after |
|---|---|
| Attendance records | 365 days |
| Notifications & announcements | 120 days |
| Events & registrations | 60 days |
| Captcha tokens | 1 hour |

---

## First Admin Account

There is no signup flow — admins are created by other admins (or seeded directly into the DB).

**Bootstrap flow:**

```sql
-- In Turso shell or dashboard:
INSERT INTO admins (name, admin_id) VALUES ('Your Full Name', 'A001');
```

1. Open the app, enter ID `A001`
2. Enter **any password** — this becomes your permanent password on first login
3. You are now logged in as an admin
4. From the Admins tab you can add more admins (they follow the same first-login pattern)

---

## Deploying to Vercel

### 1. Push to GitHub

```bash
git init && git add . && git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/techos.git
git push -u origin main
```

### 2. Import to Vercel

- Go to [vercel.com/new](https://vercel.com/new)
- Import your GitHub repo
- Vercel auto-detects Next.js — no build settings needed

### 3. Connect Turso

- Vercel Dashboard → Your project → Integrations → Browse → **Turso**
- Connect your Turso database
- Vercel auto-injects `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`

### 4. Add remaining environment variables

In Vercel → Project → Settings → Environment Variables, add:

```
JWT_SECRET        = <your 64-char hex secret>
CRON_SECRET       = <your random string>
IP_SALT           = <your random string>
NEXT_PUBLIC_APP_URL = https://your-app.vercel.app
```

### 5. Pull env vars locally (for db:init)

```bash
vercel env pull .env.local
# Then add JWT_SECRET, CRON_SECRET, IP_SALT manually to .env.local
npm run db:init
```

### 6. Deploy

```bash
vercel deploy --prod
```

Or push to `main` — Vercel auto-deploys.

---

## Cron Job

The `vercel.json` already configures a daily cleanup:

```json
{
  "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 2 * * *" }]
}
```

Vercel will call `GET /api/cron/cleanup` at 02:00 UTC every day. The endpoint is protected by the `CRON_SECRET` environment variable.

> **Note:** Vercel Cron is available on **Hobby** plan and above.

---

## ID Format Rules

| Role | Format | Examples |
|---|---|---|
| Admin | `A` + 3 digits | `A001`, `A042`, `A999` |
| Student | `S` + 3 digits | `S001`, `S042`, `S999` |

- IDs are case-insensitive on input (auto-uppercased in the UI)
- IDs must be unique within their role table
- Attempting to set a duplicate ID returns a `409 Conflict` error

---

## Event Registration Form

Each event gets a unique public URL:

```
https://your-app.vercel.app/event/<form_token>
```

The token is a 32-character UUID (hex) generated when the event is created.

### Form fields

| Field | Validation |
|---|---|
| Student Name | Required text |
| Semester | 1–8 (dropdown) |
| Department | CSE, ECE, EE, ME, AIML, BBA |
| Roll Number | Required; unique per event |
| Captcha | Math problem (e.g. `7 + 4 = ?`) |

### Security measures

- **Captcha:** Simple math challenge, stored hashed, expires in 10 minutes, single-use
- **Rate limiting:** Max 3 registration attempts per IP per event per hour
- **Deduplication:** `UNIQUE(event_id, roll)` at the DB level + app-level check
- **Pause:** Admins can pause registrations from the Events tab; form shows a paused state
- **Expiry:** After the last registration date, the form shows "Registration Closed" and all admin controls are replaced with a "Download Report" button

---

## Customisation Guide

### Change the club name / app name

Search and replace in the source:

| Find | Replace with |
|---|---|
| `IIE Tech Club` | Your club name |
| `TechOS` | Your app name |

Files to update: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/admin/page.tsx`, `src/app/student/page.tsx`, `src/app/event/[token]/page.tsx`, `src/components/admin/EventsTab.tsx`

### Change the logo

Replace `public/logo.png` with your club logo. Any size works — the image is rendered at `28×28 px` in headers and `40–56 px` on login/form pages.

### Change the timezone

In `src/lib/utils.ts`, find `timeZone: "Asia/Kolkata"` and update to your timezone (e.g. `"America/New_York"`).

### Change the colour scheme

All design tokens are CSS variables in `src/app/globals.css` under `@theme { … }`. The key colours:

| Variable | Default | Purpose |
|---|---|---|
| `--color-bg` | `#0a0a0f` | Page background |
| `--color-primary` | `#6366f1` | Indigo — buttons, active states |
| `--color-secondary` | `#22d3ee` | Cyan — student accents |
| `--color-success` | `#22c55e` | Present days, success states |
| `--color-error` | `#ef4444` | Absent days, error states |

### Add more departments

In `src/app/event/[token]/page.tsx` and `src/app/api/events/register/route.ts`, find the `DEPARTMENTS` array and add your departments.

### Change captcha difficulty

In `src/lib/utils.ts`, the `generateCaptcha()` function generates simple addition/subtraction problems. Adjust the number ranges to increase difficulty.

---

## Security Notes

- All passwords are hashed with **bcrypt** (cost factor 12)
- Session tokens are **httpOnly**, **sameSite=lax**, **secure** (in production) cookies
- JWTs are signed with HS256 using a secret you control (`JWT_SECRET`)
- **Force-logout:** Every admin action validates the admin still exists in the DB — if an admin is deleted mid-session, their next action triggers a logout
- IP addresses for rate-limiting are **SHA-256 hashed with a salt** — raw IPs are never stored
- Event captcha tokens are **single-use** and expire after 10 minutes
- The cron endpoint requires `CRON_SECRET` in the query string or `x-cron-secret` header

---

## Troubleshooting

### `TURSO_DATABASE_URL is not defined`
Run `vercel env pull .env.local` to pull Vercel-injected variables, or add them manually to `.env.local`.

### `db:init` fails with "table already exists"
The schema uses `CREATE TABLE IF NOT EXISTS` — re-running is safe. If you see other errors, check that `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` are set.

### Login says "Invalid credentials" for a new user
The user may not exist in the database yet. Check `admins` or `students` table. For admins, insert directly with SQL. For students, add them through the admin dashboard.

### Event form shows "Event not found"
The `form_token` in the URL must match exactly. Check that `NEXT_PUBLIC_APP_URL` is set correctly in your environment variables so the share link is generated with the right domain.

### PDF download is blank or errors
jsPDF is loaded lazily client-side. If you see errors, ensure `jspdf` and `jspdf-autotable` are installed (`npm install`). Also verify the attendance/registrations API is returning data before clicking download.

### Vercel cron isn't running
Cron requires Vercel **Hobby plan** or above. Verify `vercel.json` is deployed and `CRON_SECRET` is set in your Vercel environment variables. You can test manually by visiting `/api/cron/cleanup?secret=YOUR_CRON_SECRET`.

---

## License

MIT — free to use and modify for your club.

---

*Built for IIE Tech Club · Powered by TechOS*
