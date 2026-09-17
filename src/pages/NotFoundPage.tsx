import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button.tsx'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-semibold text-navy-950">Page not found</h1>
      <p className="mt-2 text-sm text-slate-600">That interviewer route does not exist.</p>
      <Link to="/interviewer/dashboard" className="mt-6 inline-block">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  )
}
