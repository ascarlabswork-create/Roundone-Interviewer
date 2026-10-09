import { useEffect } from 'react'
import { LegalDocumentView } from '../components/legal/LegalDocumentView.tsx'
import { getLegalDocument, LEGAL_PRODUCT_NAME, type LegalSlug } from '../data/legal.ts'

export function LegalPage({ slug }: { slug: LegalSlug }) {
  const legalDocument = getLegalDocument(slug)

  useEffect(() => {
    const previous = document.title
    document.title = `${legalDocument.title} · ${LEGAL_PRODUCT_NAME}`
    return () => {
      document.title = previous
    }
  }, [legalDocument.title])

  return <LegalDocumentView document={legalDocument} />
}
