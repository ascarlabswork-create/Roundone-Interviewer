# jobround.ai — Interviewer architecture & authentication

End-to-end documentation for the **Interviewer / experts** application: frontend auth, JWT sessions, signup/login, API architecture, shared Supabase backend with the Candidate product, admin console, hardcoded vs configured values, and how calls are made.

| Item | Value |
|------|--------|
| **Repo** | [Roundone-Interviewer](https://github.com/ascarlabswork-create/Roundone-Interviewer) |
| **Production** | https://experts.jobround.ai/ |
| **This app** | Interviewer workspace + staff admin console |
| **Sister product** | Candidate app (`www.jobround.ai`, separate frontend) |
| **Shared backend** | One Supabase project `fhcrxjrqtojixgqemofp` (Auth + Postgres + RLS + Edge Functions) |

Cross-product overview (both apps): see also the Candidate repo’s `docs/PROJECT_OVERVIEW.md` and `docs/ARCHITECTURE.md`.

---

## 1. High-level stack

| Layer | Technology |
|-------|------------|
| Frontend | React, TypeScript, Vite, Tailwind CSS, React Router |
| Auth & DB | Supabase Auth, PostgreSQL, Row Level Security (RLS) |
| Server logic | Supabase Edge Functions (Deno) + Postgres RPCs |
| Realtime video | LiveKit (`livekit-client` + `create-interview-token`) |
| Deploy | Vercel (frontend); Supabase (backend) |

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (experts.jobround.ai)                              │
│  React app → src/services/* → @supabase/supabase-js         │
│  Session = Supabase JWT (access_token) in localStorage      │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS + Authorization: Bearer <JWT>
┌──────────────────────────▼──────────────────────────────────┐
│  Supabase (shared with Candidate)                           │
│  • Auth (signup / OTP / Google / password)                  │
│  • Postgres + RLS (interviewers, bookings, verification, …) │
│  • Edge Functions (LiveKit, recording, account deletion, …) │
└─────────────────────────────────────────────────────────────┘
```

There is **no custom JWT server** and **no separate Nest/Express API** for core product flows. The browser talks to Supabase PostgREST, RPCs, and Edge Functions with the user’s JWT.

---

## 2. Authentication overview (JWT / sessions)

### What tokens are used?

Authentication is **Supabase Auth**:

1. After login/signup, Supabase returns a **session**:
   - `access_token` — JWT signed by Supabase (short-lived)
   - `refresh_token` — used to obtain new access tokens
2. `@supabase/supabase-js` stores the session in **browser localStorage** (`persistSession: true` in `src/lib/supabase.ts`).
3. Every `supabase.from(...)`, `supabase.rpc(...)`, and `supabase.functions.invoke(...)` call automatically sends:

   `Authorization: Bearer <access_token>`

4. Tokens **auto-refresh** (`autoRefreshToken: true`).
5. Email confirmation / recovery links use `detectSessionInUrl: true` and land on interviewer callback/reset routes.

**Frontend env (public):**

```bash
VITE_SUPABASE_URL=https://fhcrxjrqtojixgqemofp.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon / publishable key>
# Optional
VITE_PUBLIC_APP_URL=https://experts.jobround.ai
VITE_GOOGLE_CLIENT_ID=
VITE_GOOGLE_AUTHORIZED_ORIGINS=
```

Configured in `src/lib/supabase.ts`. The client **refuses** any Supabase URL that is not project ref `fhcrxjrqtojixgqemofp` so this app cannot accidentally talk to a different backend.

**Never** put `SUPABASE_SERVICE_ROLE_KEY`, LiveKit secrets, or AI keys in `VITE_*` variables.

### Session lifecycle in the app

| Step | Where | What happens |
|------|--------|--------------|
| Boot | `src/state/session.tsx` | `getCurrentUser()` → if user, `getCurrentInterviewer()` |
| Listen | `onAuthStateChange` | Reacts to login/logout/token refresh |
| Gate (interviewer) | `RequireInterviewerAuth` | Unauthenticated → `/interviewer/login?next=…`; admins redirected to `/admin` |
| Gate (admin) | `RequireAdminAuth` | Requires `profiles.role = 'admin'` |
| Persona | `claim_interviewer_persona` | Ensures `interviewer_profiles` exists (dual-persona emails) |
| Logout | `signOut()` | Clears Supabase session + local session state |

---

## 3. Interviewer signup & login (this repo)

Source of truth: `src/services/auth.ts` + auth pages under `src/pages/` / `src/components/auth/`.

### 3.1 Email + password signup

```
User fills first/last name, email, password, company, role, experience, optional phone/timezone
  → signUpInterviewer()
  → supabase.auth.signUp({
        email, password,
        options: {
          emailRedirectTo: https://experts.jobround.ai/interviewer/auth/callback?next=/interviewer/setup?step=professional,
          data: {
            full_name, first_name, last_name,
            role: 'interviewer',
            persona: 'interviewer',
            signup_app: 'interviewer',
            timezone, phone, current_role, company, experience_years
          }
        }
     })
  → interpretSignUpResponse()
```

Outcomes:

| Result | Meaning |
|--------|---------|
| `sessionCreated: true` | Immediate session |
| `needsEmailConfirmation: true` | User must confirm email; identities present |
| Empty `identities` | Treated as **duplicate email** (Supabase anti-enumeration) — user told to sign in |

**Redirect safety:** Interviewer confirmation emails must **never** open `jobround.ai` (Candidate). `buildEmailAuthRedirect` / `appOrigin()` force `experts.jobround.ai` (or `VITE_PUBLIC_APP_URL` / localhost / Vercel preview) and reject candidate public hosts.

**DB provisioning:** Auth user + `profiles` / `interviewer_profiles` are created by database triggers from signup metadata. Exact trigger names live in shared SQL migrations (often authored from Candidate repo migrations that apply to the same project).

### 3.2 Email + password login

```
signInInterviewer() → supabase.auth.signInWithPassword()
→ session (JWT) created → SessionProvider loads interviewer account
```

### 3.3 Email 6-digit OTP login (existing accounts only)

```
sendEmailSignInCode(email)
  → supabase.auth.signInWithOtp({ shouldCreateUser: false })

verifyEmailSignInCode(email, code)
  → supabase.auth.verifyOtp({ type: 'email', token })
  → session created
```

OTP does **not** create new accounts. New interviewers must register first (or use Google).

### 3.4 Google sign-in

Primary path: **Google Identity Services ID token on this origin** (not a redirect through `*.supabase.co` for the button flow).

```
requestGoogleIdCredential()
  → signInWithGoogleIdToken(credential, nonce)
  → supabase.auth.signInWithIdToken({ provider: 'google' })
  → session created
  → claim_interviewer_persona() when interviewer_profiles is missing
```

Google Client ID: `VITE_GOOGLE_CLIENT_ID` or default public web client ID in `src/lib/googleAuthOrigins.ts` (`GOOGLE_OAUTH_WEB_CLIENT_ID`). That ID is **public by design** (browser OAuth client).

### 3.5 Password reset

```
sendPasswordReset(email)
  → resetPasswordForEmail → redirectTo /interviewer/reset-password (absolute experts origin)
updatePassword(newPassword)
  → supabase.auth.updateUser({ password })
```

After reset, users are steered into interviewer welcome/setup — not Candidate.

### 3.6 Dual persona (same email, candidate + interviewer)

One email can use **both** products:

| App | Claim RPC |
|-----|-----------|
| Candidate | `claim_candidate_persona` |
| Interviewer | `claim_interviewer_persona` |

`profiles.role` may remain `candidate` while `interviewer_profiles` exists. The Interviewer app loads interviewer data via profile services and may call `claim_interviewer_persona` when needed.

### 3.7 Admin accounts

- Separate login UI: `/admin/login` (does not use interviewer auto-redirect chrome).
- Access: `profiles.role = 'admin'` (granted in SQL, not via public signup).
- Example grant (from `.env.example`):

```sql
UPDATE public.profiles SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'you@company.com' LIMIT 1);
```

Admins hitting interviewer routes are redirected to `/admin`.

---

## 4. Candidate signup (sister product — not this UI)

**This repository does not implement candidate signup screens.**

Candidates use https://www.jobround.ai/ against the **same** Supabase Auth + database:

| Topic | Candidate app | Interviewer app |
|-------|---------------|-----------------|
| Auth provider | Same Supabase Auth (JWT sessions) | Same |
| Signup metadata | `role: 'candidate'` | `role/persona: interviewer`, employment fields |
| Claim RPC | `claim_candidate_persona` | `claim_interviewer_persona` |
| Production origin | `jobround.ai` | `experts.jobround.ai` |
| Typical local port | `5173` | `5174` |

Full candidate auth detail: Candidate repo `docs/ARCHITECTURE.md`.

---

## 5. Frontend route architecture

Router: `src/app/router.tsx`.

### Public (auth / legal)

- `/`, `/interviewer`, `/interviewer/login`, `/interviewer/register`
- `/interviewer/auth/callback`, `/interviewer/reset-password`
- `/admin/login`
- Legal documents under paths from `src/data/legal.ts`

### Protected interviewer (`RequireInterviewerAuth`)

- Onboarding: `/interviewer/setup`, `/interviewer/welcome`
- Workspace: dashboard, bookings, calendar, services, reviews, earnings, notifications, profile, verification, settings
- Interview room: `/interviewer/interview/:id` (lazy-loaded LiveKit)
- Candidate history detail: `/interviewer/candidates/:id`
- Feedback: `/interviewer/feedback/:bookingId`

### Protected admin (`RequireAdminAuth`)

- `/admin/dashboard`, `/admin/verifications`, `/admin/reviews`, `/admin/bookings`, `/admin/services`, `/admin/audit`

---

## 6. API / call architecture

### Pattern

```
Page / Component
  → src/services/*.ts
    → supabase.from / .rpc / .auth / .functions.invoke
      → Postgres (RLS) or Edge Function
```

### Typical service modules

| Area | Service |
|------|---------|
| Auth | `src/services/auth.ts` |
| Account / profile / skills | `interviewerProfile.ts`, `interviewer.ts` |
| Availability / calendar | `interviewerAvailability.ts` |
| Bookings (confirm/reject/cancel/reschedule) | `interviewerBookings.ts` + RPCs |
| Services catalog | `interviewerServices.ts` |
| Dashboard / earnings / reviews | `interviewerDashboard.ts`, `interviewerEarnings.ts`, `interviewerReviews.ts` |
| Notifications | `interviewerNotifications.ts` |
| Live interview | `interviewCall.ts`, `interviewCallController.ts`, `interviewSessions.ts`, `interviewAdmission.ts` |
| Recording / notes / chat | `interviewRecording.ts`, `interviewNotes.ts`, `interviewMessages.ts` |
| Admin | `adminOperations.ts` (e.g. `moderate_interviewer_verification`) |
| Account deletion | `accountDeletion.ts` → Edge Function |

### How JWT is attached

`supabase-js` attaches the current user’s **access token** automatically. Edge Functions with `verify_jwt = true` reject missing/invalid JWTs.

Requests use a custom `fetchWithTimeout` (15s default, 60s for `/functions/v1/`) so stalled network cannot hang the auth lock forever.

---

## 7. Edge Functions (backend)

Interviewer-facing / shared functions present under `supabase/functions/` in this repo (shared project may also host Candidate-only functions such as `assist-matching`, `analyze-job`, `send-email`, `notification-worker`):

| Function | Purpose | Auth |
|----------|---------|------|
| **`create-interview-token`** | Mint LiveKit token for interview room | User JWT |
| **`interview-recording`** / **`control-interview-recording`** | Recording egress control | User JWT (+ privileged server secrets as needed) |
| **`end-interview-call`** | End / tear down call side effects | User JWT |
| **`delete-interviewer-account`** | Account deletion workflow | User JWT; may use service role server-side |

**Secrets stay on Supabase** (Dashboard / CLI): `SUPABASE_SERVICE_ROLE_KEY`, `LIVEKIT_*`, storage/S3, email, etc. Not in the Vite bundle.

---

## 8. Database & RLS (conceptual)

- Sensitive tables protected by **RLS**.
- Browser uses **publishable key + user JWT**; RLS scopes rows to the owning interviewer (and public directory views for Candidate).
- Privileged writes use **security definer RPCs** (examples: `confirm`/`reject`/`cancel`/`reschedule_booking`, `list_bookable_slots`, `claim_interviewer_persona`, `moderate_interviewer_verification`) or Edge Functions with **service role**.

Illustrative objects:

- `profiles`, `interviewer_profiles`, `interviewer_skills`, `interviewer_services`
- `interviewer_availability`, custom slots, blocked times
- `bookings`, `payments`, `interview_sessions`, notifications, verification rows
- Candidate-facing public views of interviewers (defined in shared migrations)

---

## 9. What is hardcoded vs configured?

### Configured (env / secrets)

| Item | Where |
|------|--------|
| Supabase URL + publishable key | `VITE_*` (required) |
| Public app URL for email redirects | `VITE_PUBLIC_APP_URL` |
| Google OAuth client ID | `VITE_GOOGLE_CLIENT_ID` (optional override) |
| Extra Google origins | `VITE_GOOGLE_AUTHORIZED_ORIGINS` |
| LiveKit / service role / email | Edge Function / Supabase secrets |
| Auth redirect allowlist | Supabase Dashboard + `supabase/config.toml` (shared) |

### Hardcoded / client-side (by design or convenience)

| Item | Location | Notes |
|------|----------|--------|
| Expected Supabase project ref | `src/lib/supabase.ts` → `fhcrxjrqtojixgqemofp` | Guards wrong project |
| Production interviewer origin | `INTERVIEWER_PRODUCTION_ORIGIN` in `auth.ts` | Fallback for email links |
| Default Google web client ID | `googleAuthOrigins.ts` | Public OAuth client; overridable via env |
| Builtin Google origins list | same file | localhost + jobround + experts |
| Skills / roles catalogs | `src/data/catalogs.ts` | UI suggestion lists |
| Legal copy | `src/data/legal.ts` | Static policy pages |
| Admin grant | SQL only | No public “become admin” UI |

### Not hardcoded (live)

- Auth users and JWT sessions (Supabase Auth)
- Profiles, skills, availability, bookings, verification, earnings data (Postgres)
- Interview join tokens (Edge + LiveKit)

---

## 10. Frontend ↔ backend request map (examples)

| User action | Frontend | Backend |
|-------------|----------|---------|
| Register | `signUpInterviewer` | Supabase Auth + DB trigger |
| Login password | `signInInterviewer` | Supabase Auth |
| Login OTP | `sendEmailSignInCode` / `verifyEmailSignInCode` | Supabase Auth |
| Google | `signInWithGoogleIdToken` | Supabase Auth |
| Ensure interviewer row | `claimInterviewerPersona` | RPC `claim_interviewer_persona` |
| Load account | `getCurrentInterviewer` / `getInterviewerProfile` | tables + joins |
| List / act on bookings | `interviewerBookings.ts` | tables + booking RPCs |
| Reschedule | `rescheduleMyBooking` | RPC `reschedule_booking` |
| Open slots | `listMyBookableSlots` | RPC `list_bookable_slots` |
| Join interview | interview call services | Edge `create-interview-token` → LiveKit |
| Approve verification (admin) | `adminOperations` | RPC `moderate_interviewer_verification` |
| Delete account | `accountDeletion` | Edge `delete-interviewer-account` |

---

## 11. Security notes

1. **Publishable key is public** — security relies on RLS + JWT, not on hiding the anon key.
2. **Service role** only in Edge Functions / server secrets.
3. **Role / persona** enforced server-side (DB + claim RPCs); client signup metadata is advisory for provisioning.
4. **Admin** is not self-serve; SQL grant required.
5. Interviewer auth redirects must stay on **experts** origins so confirmation emails do not open the Candidate app.
6. Google Client ID in the repo is a **public** browser OAuth client ID; the secret stays in Supabase Auth provider config.

---

## 12. Local development

```bash
cp .env.example .env.local
# Fill VITE_SUPABASE_PUBLISHABLE_KEY (URL is already the shared project)

npm install
npm run dev -- --host localhost --port 5174
```

Scripts (see `package.json`): `dev`, `build`, `preview`, `lint`, tests via Vitest where configured.

---

## 13. Related source files (quick index)

| Topic | Path |
|-------|------|
| Supabase client | `src/lib/supabase.ts` |
| Auth API | `src/services/auth.ts` |
| Google One Tap / GIS | `src/lib/googleOneTap.ts`, `src/lib/googleAuthOrigins.ts` |
| Session | `src/state/session.tsx` |
| Interviewer gate | `src/components/auth/RequireInterviewerAuth.tsx` |
| Admin gate | `src/components/auth/RequireAdminAuth.tsx` |
| Profile load | `src/services/interviewerProfile.ts` |
| Router | `src/app/router.tsx` |
| Env template | `.env.example` |
| Product features | [FEATURES.md](./FEATURES.md) |

---

## 14. End-to-end auth diagram

```
                 ┌──────────────┐
                 │   Browser    │
                 │ experts.*    │
                 └──────┬───────┘
        email/password  │  OTP  │  Google ID token
                        ▼
              ┌─────────────────────┐
              │   Supabase Auth     │
              │  issues JWT session │
              └──────────┬──────────┘
                         │ access_token (localStorage)
                         ▼
              ┌─────────────────────┐
              │ SessionProvider     │
              │ getCurrentInterviewer│
              │ claim_interviewer_… │
              └──────────┬──────────┘
           ┌─────────────┴──────────────┐
           │ role admin                 │ interviewer account OK
           ▼                            ▼
     RequireAdminAuth            RequireInterviewerAuth
     /admin/*                    /interviewer/*
           │                            │
           └────────────┬───────────────┘
                        ▼
        supabase.from / rpc / functions.invoke
        (Bearer JWT → RLS / verify_jwt)
```

---

*Aligned with the Interviewer codebase (auth services, session gates, shared Supabase project `fhcrxjrqtojixgqemofp`). Candidate UI and AI practice Edge Functions are documented in the Candidate repository.*
