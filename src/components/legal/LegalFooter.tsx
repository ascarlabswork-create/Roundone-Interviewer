import { Link } from 'react-router-dom'
import { LEGAL_COPYRIGHT, LEGAL_DOCUMENTS } from '../../data/legal.ts'
import { cn } from '../../lib/cn.ts'
import { useCookieConsent } from '../../state/cookieConsent.tsx'

export function LegalFooter({ className }: { className?: string }) {
  const { openCookiePreferences } = useCookieConsent()

  return (
    <footer className={cn('border-t border-slate-200 bg-white', className)}>
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-sm text-slate-600 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <p>{LEGAL_COPYRIGHT}</p>
        <nav aria-label="Legal">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            {LEGAL_DOCUMENTS.map((document) => (
              <li key={document.slug}>
                <Link
                  to={document.path}
                  className="rounded-sm font-medium text-slate-700 underline-offset-4 hover:text-navy-950 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                >
                  {document.footerLabel}
                </Link>
              </li>
            ))}
            <li>
              <button
                type="button"
                onClick={() => openCookiePreferences()}
                className="rounded-sm font-medium text-slate-700 underline-offset-4 hover:text-navy-950 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Cookie preferences
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  )
}
