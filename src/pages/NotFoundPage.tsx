import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-navy-950">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">That route does not exist.</p>
      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link to="/interviewer/dashboard">
          <Button variant="outline">Interviewer dashboard</Button>
        </Link>
        <Link to="/admin/login">
          <Button>Admin sign in</Button>
        </Link>
      </div>
    </div>
  )
}
