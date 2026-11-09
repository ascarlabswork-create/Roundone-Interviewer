import type { VerificationStatusItem } from '../services/interviewerProfile.ts'

export const VERIFICATION_SUBMITTED_PATH = '/interviewer/verification/submitted'

const REQUEST_KINDS = ['identity', 'employment'] as const

export function verificationKindsRequested(verifications: readonly VerificationStatusItem[]) {
  return REQUEST_KINDS.every((kind) => verifications.some((row) => row.kind === kind && row.id))
}
