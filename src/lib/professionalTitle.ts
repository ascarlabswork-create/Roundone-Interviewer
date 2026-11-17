/** Normalize for title comparisons (case/spacing insensitive). */
export function normalizeProfessionalText(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function textIncludesCompany(haystack: string, company: string) {
  const h = normalizeProfessionalText(haystack)
  const c = normalizeProfessionalText(company)
  if (!c) return false
  return h.includes(c) || h.includes(`@ ${c}`)
}

/** True when headline already leads with the same job title (avoids "Role · …" + "Role @ Co"). */
export function headlineCoversRole(headline: string, role: string) {
  const h = normalizeProfessionalText(headline)
  const r = normalizeProfessionalText(role)
  if (!h || !r) return false
  if (h === r) return true
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
  /** Role @ company, company alone, or empty when already covered by headline. */
  detail: string
}

/**
 * Build non-duplicated title lines for interviewer profile cards.
 * Example bug: headline "software Engineer · System Design" + detail "software Engineer @ asc".
 */
export function professionalTitleLines(input: {
  headline?: string | null
  currentRole?: string | null
  company?: string | null
}): ProfessionalTitleLines {
  const role = (input.currentRole ?? '').trim()
  const company = (input.company ?? '').trim()
  const rawHeadline = (input.headline ?? '').trim()
  const roleAtCompany = [role, company].filter(Boolean).join(' @ ')

  const headlineIsOnlyRoleOrJob =
    !rawHeadline ||
    normalizeProfessionalText(rawHeadline) === normalizeProfessionalText(role) ||
    normalizeProfessionalText(rawHeadline) === normalizeProfessionalText(roleAtCompany)

  const headline = headlineIsOnlyRoleOrJob ? '' : rawHeadline

  if (!headline) {
    return { headline: '', detail: roleAtCompany }
  }

  if (headlineCoversRole(headline, role)) {
    const companyOnly =
      company && !textIncludesCompany(headline, company) ? company : ''
    return { headline, detail: companyOnly }
  }

  return { headline, detail: roleAtCompany }
}
