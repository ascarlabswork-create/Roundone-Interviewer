import { AlertTriangle } from 'lucide-react'
import {
  LEGAL_COMPANY_NAME,
  PENDING_APPROVAL_LABEL,
  type LegalBlock,
  type LegalDocument,
} from '../../data/legal.ts'
import { Card } from '../ui/primitives.tsx'

function PendingApproval({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">{PENDING_APPROVAL_LABEL}:</span> {text}
      </p>
    </div>
  )
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === 'pending') return <PendingApproval text={block.text} />
  if (block.type === 'list') {
    return (
      <ul className="list-disc space-y-2 pl-5">
        {block.items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )
  }
  return <p>{block.text}</p>
}

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  const hasPending = document.sections.some((section) => section.blocks.some((block) => block.type === 'pending'))

  return (
    <article className="mx-auto w-full max-w-3xl" aria-labelledby="legal-title">
      <header>
        <p className="text-sm font-medium text-slate-500">{LEGAL_COMPANY_NAME}</p>
        <h1 id="legal-title" className="mt-1 text-3xl font-semibold tracking-tight text-navy-950">
          {document.title}
        </h1>
        <p className="mt-3 text-base text-slate-600">{document.summary}</p>
        {hasPending ? (
          <p className="mt-4 text-sm text-slate-500">
            Items marked “{PENDING_APPROVAL_LABEL}” are not final and will be confirmed by the company.
          </p>
        ) : null}
      </header>

      <nav aria-label="On this page" className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">On this page</h2>
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {document.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-blue-700 underline-offset-4 hover:underline">
                {section.heading}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Card className="mt-6 divide-y divide-slate-100">
        {document.sections.map((section) => (
          <section key={section.id} id={section.id} aria-labelledby={`${section.id}-heading`} className="scroll-mt-24 px-5 py-6 sm:px-8">
            <h2 id={`${section.id}-heading`} className="text-lg font-semibold text-navy-950">
              {section.heading}
            </h2>
            <div className="mt-3 space-y-3 text-sm leading-6 text-slate-700">
              {section.blocks.map((block, index) => (
                <Block key={`${section.id}-${index}`} block={block} />
              ))}
            </div>
          </section>
        ))}
      </Card>
    </article>
  )
}
