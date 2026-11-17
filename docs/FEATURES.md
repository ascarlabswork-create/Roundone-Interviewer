# jobround.ai — Interviewer product features

Feature inventory for the **Interviewer / experts** app (`experts.jobround.ai`). For auth/API detail see [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Workspace (signed-in interviewer)

| Feature | What it does | Primary surfaces |
|---------|----------------|------------------|
| **Dashboard** | Overview of upcoming sessions, readiness, notifications | `/interviewer/dashboard` |
| **Bookings** | Pending / upcoming / completed / cancelled tabs; confirm, reject, cancel, **reschedule**, join, feedback | `/interviewer/bookings` |
| **Calendar / availability** | Weekly hours, custom slots, blocked times; bookable slots feed Candidate booking | `/interviewer/calendar` |
| **Services** | Optional paid services (name, type, duration, price); matching can work on skills alone | `/interviewer/services` |
| **Profile & expertise** | Bio, headline, skills (multi-add / comma split), target roles, employment summary | `/interviewer/profile`, setup/welcome |
| **Verification** | Submit identity / employment evidence; status tracked; admin moderates | `/interviewer/verification*` |
| **Live interview room** | LiveKit 1:1 video, timing rules (early lobby / late join), notes, messages, recording save | `/interviewer/interview/:id` |
| **Feedback** | Structured post-session feedback for the candidate | `/interviewer/feedback/:bookingId` |
| **Reviews** | Reviews left about the interviewer | `/interviewer/reviews` |
| **Earnings** | Session fees / earnings views (payout operations as implemented) | `/interviewer/earnings` |
| **Notifications** | In-app booking lifecycle alerts; preferences in settings | `/interviewer/notifications`, settings |
| **Settings** | Notification prefs, WhatsApp contact (private), account deletion, etc. | `/interviewer/settings` |
| **Candidate history** | History with a booked candidate (not a global directory) | `/interviewer/candidates/:id` |

---

## Auth & onboarding

| Feature | Notes |
|---------|--------|
| Email/password signup & login | Signup captures employment metadata for verification/profile |
| Email OTP login | Existing accounts only |
| Google Continue | GIS ID token → Supabase session |
| Password reset | Redirect stays on experts origin |
| Setup / welcome | Guided first-run (skills, roles, optional service) |
| Dual persona | Same email can also be a Candidate on jobround.ai |

---

## Admin console (staff)

| Feature | Path |
|---------|------|
| Admin login | `/admin/login` |
| Dashboard | `/admin/dashboard` |
| Verification moderation (approve/reject, full profile cards) | `/admin/verifications` |
| Reviews / bookings / services oversight | `/admin/reviews`, `/admin/bookings`, `/admin/services` |
| Audit | `/admin/audit` |

Admin role is granted in SQL (`profiles.role = 'admin'`), not via public registration.

---

## Shared platform capabilities (with Candidate)

- Shared bookings lifecycle (`requested` → `confirmed` → `in_progress` / `completed`, plus reject/cancel/reschedule/expired/no_show)
- Shared LiveKit interview rooms (both sides mint tokens via Edge Functions)
- Shared notifications kinds (booking requested, confirmed, cancelled, rescheduled, …)
- Public interviewer directory consumed by Candidate (skills overlap, verification status)

---

## Explicitly out of scope for this app

- Candidate AI practice / ATS / job-match UIs (Candidate repo)
- Live card payment capture (stub / skip-payment paths as configured in DB)
- Self-serve “become admin”
