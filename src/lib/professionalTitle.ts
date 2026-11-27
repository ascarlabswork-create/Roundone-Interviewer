/** Normalize for title comparisons (case/spacing insensitive). */
export function normalizeProfessionalText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

/** First phrase of a headline before · / @ / dash separators. */
function headlineLead(headline: string) {
  const h = normalizeProfessionalText(headline)
  const lead = h.split(/\s*[·•|/\\,@]\s*|\s+[–—-]\s+/)[0] ?? h
  return lead.trim()
}

/** True when headline already leads with the same job title (avoids "Role · …" + "Role @ Co"). */
export function headlineCoversRole(headline: string, role: string) {
  const h = normalizeProfessionalText(headline)
  const r = normalizeProfessionalText(role)
  if (!h || !r) return false
  if (h === r || headlineLead(headline) === r) return true
  return (
    h.startsWith(`${r} `) ||
    h.startsWith(`${r}·`) ||
    h.startsWith(`${r} ·`) ||
    h.startsWith(`${r},`) ||
    h.startsWith(`${r} -`) ||
    h.startsWith(`${r} –`) ||
    h.startsWith(`${r} —`)
  )
}

export type ProfessionalTitleLines = {
  /** Distinct headline, or empty when it only repeats the role. */
  headline: string
  /** Role only, or empty when already covered by headline. Company is never shown. */
  detail: string
}

/**
 * Build non-duplicated title lines for interviewer profile cards.
 * Company is kept off candidate-facing copy — show role / headline only.
 * Example bug: headline "software Engineer · System Design" + detail "software Engineer @ asc".
 */
export function professionalTitleLines(input: {
  headline?: string | null
  currentRole?: string | null
  company?: string | null
}): ProfessionalTitleLines {
  const role = (input.currentRole ?? '').trim()
  const rawHeadline = (input.headline ?? '').trim()
  // company is intentionally ignored for public/candidate display
  void input.company

  const headlineIsOnlyRole =
    !rawHeadline || normalizeProfessionalText(rawHeadline) === normalizeProfessionalText(role)

  const headline = headlineIsOnlyRole ? '' : rawHeadline

  if (!headline) {
    return { headline: '', detail: role }
  }

  if (headlineCoversRole(headline, role)) {
    return { headline, detail: '' }
  }

  return { headline, detail: role }
}
