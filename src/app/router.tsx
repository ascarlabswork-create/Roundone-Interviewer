import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '../components/layout/AppShell.tsx'
import { PublicLayout } from '../components/layout/PublicLayout.tsx'
import { BookingsPage } from '../pages/BookingsPage.tsx'
import { CalendarPage } from '../pages/CalendarPage.tsx'
import { CandidateDetailPage } from '../pages/CandidateDetailPage.tsx'
import { CandidatesPage } from '../pages/CandidatesPage.tsx'
import { DashboardPage } from '../pages/DashboardPage.tsx'
import { EarningsPage } from '../pages/EarningsPage.tsx'
import { FeedbackPage } from '../pages/FeedbackPage.tsx'
import { InterviewRoomPage } from '../pages/InterviewRoomPage.tsx'
import { LandingPage } from '../pages/LandingPage.tsx'
import { NotFoundPage } from '../pages/NotFoundPage.tsx'
import { ProfilePage } from '../pages/ProfilePage.tsx'
import { RegisterPage } from '../pages/RegisterPage.tsx'
import { ReviewsPage } from '../pages/ReviewsPage.tsx'
import { ServicesPage } from '../pages/ServicesPage.tsx'
import { SettingsPage } from '../pages/SettingsPage.tsx'
import { SetupPage } from '../pages/SetupPage.tsx'
import { VerificationPage } from '../pages/VerificationPage.tsx'

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/interviewer" replace />} />
        <Route element={<PublicLayout />}>
          <Route path="/interviewer" element={<LandingPage />} />
          <Route path="/interviewer/register" element={<RegisterPage />} />
          <Route path="/interviewer/setup" element={<SetupPage />} />
          <Route path="/interviewer/verification" element={<VerificationPage />} />
        </Route>
        <Route element={<AppShell />}>
          <Route path="/interviewer/dashboard" element={<DashboardPage />} />
          <Route path="/interviewer/bookings" element={<BookingsPage />} />
          <Route path="/interviewer/calendar" element={<CalendarPage />} />
          <Route path="/interviewer/services" element={<ServicesPage />} />
          <Route path="/interviewer/candidates" element={<CandidatesPage />} />
          <Route path="/interviewer/candidates/:id" element={<CandidateDetailPage />} />
          <Route path="/interviewer/feedback/:bookingId" element={<FeedbackPage />} />
          <Route path="/interviewer/reviews" element={<ReviewsPage />} />
          <Route path="/interviewer/earnings" element={<EarningsPage />} />
          <Route path="/interviewer/profile" element={<ProfilePage />} />
          <Route path="/interviewer/settings" element={<SettingsPage />} />
        </Route>
        <Route path="/interviewer/interview/:id" element={<InterviewRoomPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}
