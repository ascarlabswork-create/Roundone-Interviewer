# jobround.ai — Interviewer application

Interviewer-facing app for verified experts: availability, bookings, live interviews (LiveKit), feedback, earnings, and staff admin moderation.

**Repo:** https://github.com/ascarlabswork-create/Roundone-Interviewer  
**Production:** https://experts.jobround.ai/

> **Everything in one file:** **[docs/JOBROUND_FULL_DOCUMENTATION.md](./docs/JOBROUND_FULL_DOCUMENTATION.md)**  
> (auth/JWT, both signups, APIs, Edge Functions, features, hardcoded vs env)  
>  
> Split docs (optional): [ARCHITECTURE](./docs/ARCHITECTURE.md) · [FEATURES](./docs/FEATURES.md)  

Sister app (same Supabase backend): [Roundone-Candidate](https://github.com/ascarlabswork-create/Roundone-Candidate) → https://www.jobround.ai/

---

## Stack

| Layer | Choice |
|-------|--------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router |
| Backend | Supabase Auth + PostgreSQL + RLS + Edge Functions |
| Video | LiveKit |
| Deploy | Vercel (UI) + Supabase (data/auth/functions) |

There is **no custom JWT microservice**. Sessions are **Supabase Auth JWTs** (`access_token` + `refresh_token`) stored in **localStorage** by `@supabase/supabase-js`. Every table/RPC/function call sends `Authorization: Bearer <access_token>`.

---

## Authentication (summary)

| Mechanism | How |
|-----------|-----|
| Session | Supabase JWT in localStorage; auto-refresh |
| Email signup / password login | `signUpInterviewer` / `signInInterviewer` in `src/services/auth.ts` |
| Email 6-digit OTP | `signInWithOtp` + `verifyOtp` (existing accounts only) |
| Google | Google Identity Services → `signInWithIdToken` |
| Dual persona | RPC `claim_interviewer_persona` |
| Interviewer gate | `RequireInterviewerAuth` → `/interviewer/login?next=…` |
| Admin | `/admin/login` + `profiles.role = 'admin'` (SQL grant) |

**Candidate signup** lives in the Candidate app, not this repo. Both apps share Auth users and the same project (`fhcrxjrqtojixgqemofp`).

---

## API architecture (summary)

```
UI pages → src/services/*
        → supabase.from / .rpc / .auth / .functions.invoke
        → Postgres (RLS) or Edge Functions
```

Examples: booking RPCs (`reschedule_booking`, `list_bookable_slots`, …), LiveKit `create-interview-token`, admin `moderate_interviewer_verification`, account deletion Edge Function.

---

## Required frontend environment

Copy `.env.example` → `.env.local`:

```bash
VITE_SUPABASE_URL=https://fhcrxjrqtojixgqemofp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
# Optional
# VITE_PUBLIC_APP_URL=https://experts.jobround.ai
# VITE_GOOGLE_CLIENT_ID=
# VITE_GOOGLE_AUTHORIZED_ORIGINS=
```

Never expose `SUPABASE_SERVICE_ROLE_KEY` or LiveKit secrets via `VITE_*`.

---

## Local development

```bash
npm install
npm run dev -- --host localhost --port 5174
```

Typical scripts: `dev`, `build`, `preview`, `lint`, Vitest for unit tests.

---

## Main routes

**Public:** login, register, auth callback, password reset, legal, `/admin/login`  

**Interviewer (JWT + interviewer profile):** dashboard, bookings, calendar, services, profile, verification, settings, interview room, feedback, reviews, earnings, notifications  

**Admin (JWT + `role=admin`):** dashboard, verifications, reviews, bookings, services, audit  

---

## Documentation map

| Doc | Contents |
|-----|----------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Frontend + backend auth, JWT, signup flows (interviewer & candidate), API/Edge Functions, RLS, hardcoded catalogs, security |
| [docs/FEATURES.md](./docs/FEATURES.md) | Product features for interviewer workspace and admin |
| This README | Quick start, env, routes, short auth/API summary |
