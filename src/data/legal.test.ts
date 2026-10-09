import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { LegalFooter } from '../components/legal/LegalFooter.tsx'
import { LegalPage } from '../pages/LegalPage.tsx'
import { LEGAL_COPYRIGHT, LEGAL_DOCUMENTS, PENDING_APPROVAL_LABEL, getLegalDocument } from './legal.ts'

const render = (node: ReturnType<typeof createElement>) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, node))

describe('legal documents', () => {
  it('uses the same five routes as the Candidate app, in footer order', () => {
    expect(LEGAL_DOCUMENTS.map((item) => [item.path, item.footerLabel])).toEqual([
      ['/privacy', 'Privacy Policy'],
      ['/terms', 'Terms of Service'],
      ['/refund-policy', 'Refund & Cancellation Policy'],
      ['/pricing', 'Pricing & Billing Terms'],
      ['/contact', 'Contact Us'],
    ])
  })

  it('has unique, non-empty sections in every document', () => {
    for (const item of LEGAL_DOCUMENTS) {
      const ids = item.sections.map((section) => section.id)
      expect(new Set(ids).size).toBe(ids.length)
      for (const section of item.sections) expect(section.blocks.length).toBeGreaterThan(0)
    }
  })

  it('does not publish unapproved contact details', () => {
    const copy = JSON.stringify(LEGAL_DOCUMENTS)
    expect(copy).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
    expect(copy).not.toMatch(/\+?\d[\d\s-]{8,}\d/)
  })

  it('marks unresolved terms on the contact page for company approval', () => {
    const blocks = getLegalDocument('contact').sections.flatMap((section) => section.blocks)
    expect(blocks.some((block) => block.type === 'pending' && block.text.includes('grievance officer'))).toBe(true)
  })

  it('covers interviewer-specific disclosures in the privacy policy', () => {
    const ids = getLegalDocument('privacy').sections.map((section) => section.id)
    expect(ids).toEqual(
      expect.arrayContaining(['interviewer-verification', 'recordings', 'ai-processing', 'retention', 'account-deletion', 'your-rights']),
    )
  })
})

describe('LegalFooter', () => {
  it('renders the copyright and links to all legal pages', () => {
    const html = render(createElement(LegalFooter))
    expect(LEGAL_COPYRIGHT).toBe('© 2026 Ascar Labs India Private Limited. All rights reserved.')
    expect(html).toContain(LEGAL_COPYRIGHT)
    expect(html).toContain('aria-label="Legal"')
    for (const item of LEGAL_DOCUMENTS) {
      expect(html).toContain(`href="${item.path}"`)
    }
    expect(html).toContain('Refund &amp; Cancellation Policy')
  })
})

describe('LegalPage', () => {
  it.each(LEGAL_DOCUMENTS.map((item) => item.slug))('renders %s with a heading and approval markers', (slug) => {
    const legalDocument = getLegalDocument(slug)
    const html = render(createElement(LegalPage, { slug }))
    expect(html).toContain('id="legal-title"')
    expect(html).toContain(legalDocument.title.replace('&', '&amp;'))
    for (const section of legalDocument.sections) expect(html).toContain(`id="${section.id}"`)
    expect(html).toContain(PENDING_APPROVAL_LABEL)
  })
})
