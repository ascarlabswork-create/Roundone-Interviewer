import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthLayout } from '../components/auth/AuthLayout.tsx'
import { RequireAdminAuth } from '../components/auth/RequireAdminAuth.tsx'
import { RequireInterviewerAuth } from '../components/auth/RequireInterviewerAuth.tsx'
import { UnknownRoute } from '../components/auth/UnknownRoute.tsx'
import { AdminShell } from '../components/layout/AdminShell.tsx'
import { AppShell } from '../components/layout/AppShell.tsx'
import { LegalLayout } from '../components/layout/LegalLayout.tsx'
import { PublicLayout } from '../components/layout/PublicLayout.tsx'
import { LEGAL_DOCUMENTS } from '../data/legal.ts'
import { AuthCallbackPage } from '../pages/AuthCallbackPage.tsx'
import { BookingsPage } from '../pages/BookingsPage.tsx'
import { CalendarPage } from '../pages/CalendarPage.tsx'
import { CandidateDetailPage } from '../pages/CandidateDetailPage.tsx'
import { DashboardPage } from '../pages/DashboardPage.tsx'
import { EarningsPage } from '../pages/EarningsPage.tsx'
import { FeedbackPage } from '../pages/FeedbackPage.tsx'
import { LegalPage } from '../pages/LegalPage.tsx'
import { LoginPage } from '../pages/LoginPage.tsx'
import { NotificationsPage } from '../pages/NotificationsPage.tsx'
import { ProfilePage } from '../pages/ProfilePage.tsx'
import { RegisterPage } from '../pages/RegisterPage.tsx'
import { ReviewsPage } from '../pages/ReviewsPage.tsx'
import { ServicesPage } from '../pages/ServicesPage.tsx'
import { SettingsPage } from '../pages/SettingsPage.tsx'
import { SetupPage } from '../pages/SetupPage.tsx'
import { VerificationPage } from '../pages/VerificationPage.tsx'
import { AdminAuditPage } from '../pages/admin/AdminAuditPage.tsx'
import { AdminBookingsPage } from '../pages/admin/AdminBookingsPage.tsx'
import { AdminDashboardPage } from '../pages/admin/AdminDashboardPage.tsx'
import { AdminReviewsPage } from '../pages/admin/AdminReviewsPage.tsx'
import { AdminServicesPage } from '../pages/admin/AdminServicesPage.tsx'
import { AdminVerificationsPage } from '../pages/admin/AdminVerificationsPage.tsx'

// Loaded on demand so livekit-client stays out of the main bundle.
const InterviewRoomPage = lazy(() =>
  import('../pages/InterviewRoomPage.tsx').then((module) => ({ default: module.InterviewRoomPage })),
)

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AuthLayout />}>
          <Route path="/" element={<LoginPage />} />
          <Route path="/interviewer" element={<LoginPage />} />
          <Route path="/interviewer/login" element={<LoginPage />} />
          <Route path="/interviewer/register" element={<RegisterPage />} />
          <Route path="/interviewer/auth/callback" element={<AuthCallbackPage />} />
        </Route>
        <Route element={<LegalLayout />}>
          {LEGAL_DOCUMENTS.map((legalDocument) => (
            <Route key={legalDocument.slug} path={legalDocument.path} element={<LegalPage slug={legalDocument.slug} />} />
          ))}
        </Route>
        <Route element={<RequireAdminAuth />}>
          <Route element={<AdminShell />}>
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
            <Route path="/admin/verifications" element={<AdminVerificationsPage />} />
            <Route path="/admin/reviews" element={<AdminReviewsPage />} />
            <Route path="/admin/bookings" element={<AdminBookingsPage />} />
            <Route path="/admin/services" element={<AdminServicesPage />} />
            <Route path="/admin/audit" element={<AdminAuditPage />} />
          </Route>
        </Route>
        <Route element={<RequireInterviewerAuth />}>
          <Route element={<PublicLayout />}>
            <Route path="/interviewer/setup" element={<SetupPage />} />
          </Route>
          <Route element={<AppShell />}>
            <Route path="/interviewer/dashboard" element={<DashboardPage />} />
            <Route path="/interviewer/bookings" element={<BookingsPage />} />
            <Route path="/interviewer/calendar" element={<CalendarPage />} />
            <Route path="/interviewer/services" element={<ServicesPage />} />
            <Route path="/interviewer/candidates" element={<Navigate to="/interviewer/bookings" replace />} />
            <Route path="/interviewer/candidates/:id" element={<CandidateDetailPage />} />
            <Route path="/interviewer/feedback/:bookingId" element={<FeedbackPage />} />
            <Route path="/interviewer/reviews" element={<ReviewsPage />} />
            <Route path="/interviewer/earnings" element={<EarningsPage />} />
            <Route path="/interviewer/notifications" element={<NotificationsPage />} />
            <Route path="/interviewer/profile" element={<ProfilePage />} />
            <Route path="/interviewer/verification" element={<VerificationPage />} />
            <Route path="/interviewer/settings" element={<SettingsPage />} />
          </Route>
          <Route
            path="/interviewer/interview/:id"
            element={
              <Suspense fallback={<div className="min-h-svh bg-navy-950" />}>
                <InterviewRoomPage />
              </Suspense>
            }
          />
        </Route>
        <Route path="*" element={<UnknownRoute />} />
      </Routes>
    </BrowserRouter>
  )
}
