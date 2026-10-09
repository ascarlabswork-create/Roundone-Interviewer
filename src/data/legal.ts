/**
 * Shared RoundOne legal copy. Keep this file identical in the Interviewer and Candidate apps.
 * Every `pending` block marks a term that still needs company approval.
 */

export const LEGAL_COMPANY_NAME = 'Ascar Labs India Private Limited'
export const LEGAL_PRODUCT_NAME = 'jobround.ai'
export const LEGAL_COPYRIGHT = `© 2026 ${LEGAL_COMPANY_NAME}. All rights reserved.`
export const PENDING_APPROVAL_LABEL = 'Pending company approval'

export type LegalSlug = 'privacy' | 'terms' | 'refund-policy' | 'pricing' | 'contact'

export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'pending'; text: string }

export type LegalSection = {
  id: string
  heading: string
  blocks: LegalBlock[]
}

export type LegalDocument = {
  slug: LegalSlug
  path: `/${LegalSlug}`
  title: string
  footerLabel: string
  summary: string
  sections: LegalSection[]
}

const p = (text: string): LegalBlock => ({ type: 'p', text })
const list = (...items: string[]): LegalBlock => ({ type: 'list', items })
const pending = (text: string): LegalBlock => ({ type: 'pending', text })

const effectiveDateSection: LegalSection = {
  id: 'effective-date',
  heading: 'Effective date and changes',
  blocks: [
    pending('Effective date, version history, and how users are notified of changes to this document.'),
    p(
      'We will update this page when the way the Service works changes. Material changes will be communicated through the Service before they take effect.',
    ),
  ],
}

const privacy: LegalDocument = {
  slug: 'privacy',
  path: '/privacy',
  title: 'Privacy Policy',
  footerLabel: 'Privacy Policy',
  summary: `How ${LEGAL_COMPANY_NAME} collects, uses, shares, and retains personal data when you use ${LEGAL_PRODUCT_NAME} as an interviewer or candidate.`,
  sections: [
    {
      id: 'who-we-are',
      heading: 'Who we are',
      blocks: [
        p(
          `${LEGAL_PRODUCT_NAME} (the “Service”) is operated by ${LEGAL_COMPANY_NAME} (“we”, “us”). The Service connects candidates with professional interviewers for mock interviews, feedback, and related preparation.`,
        ),
        pending('Registered office address, data protection contact, and grievance officer details.'),
      ],
    },
    {
      id: 'data-we-collect',
      heading: 'Information we collect',
      blocks: [
        p('Depending on how you use the Service, we collect:'),
        list(
          'Account details: your name, email address, and sign-in method (email and password, or Google sign-in).',
          'Professional profile: headline, bio, current company and role, years of experience, skills, languages, target roles and candidate levels you interview for, timezone, profile photo, LinkedIn URL, and phone number.',
          'Contact preferences: an optional WhatsApp number and your notification settings.',
          'Candidate preparation details: matching preferences, skills, job targets, and skills and projects identified from a resume.',
          'Services, prices, and availability you publish for candidates to book.',
          'Booking records: services booked, session times, fees, status changes, and cancellation or reschedule details.',
          'Payment records: amounts, currency, and payment status linked to each booking.',
          'Interview session data: session status and join events, shared in-room chat messages, private notes you write, and recordings if a participant starts recording.',
          'Feedback and reviews: feedback interviewers write for candidates, reviews candidates write about interviewers, and optional feedback about the Service.',
        ),
      ],
    },
    {
      id: 'interviewer-verification',
      heading: 'Interviewer profile and verification evidence',
      blocks: [
        p(
          'Interviewer profiles are reviewed by our administrators. Verification is tracked separately for identity, employment, and LinkedIn, and each status is set by an administrator after review. A verification badge reflects that review; it is not a guarantee of a person’s identity, employment, or skills.',
        ),
        p(
          'The Service does not currently accept uploads of identity documents or other credential files, and professional email verification is not yet available. If credential uploads are added, this policy will be updated first to describe what is collected, who can see it, and how long it is kept.',
        ),
        pending('Which evidence is required for each verification type and how long verification evidence is retained.'),
      ],
    },
    {
      id: 'recordings',
      heading: 'Interview audio, video, and recordings',
      blocks: [
        p(
          'Live interviews run in the browser using real-time audio and video provided by LiveKit. Audio and video are transmitted to the other participant during the session and are not stored unless recording is started.',
        ),
        list(
          'Recording is optional. Either participant can start or stop a recording while the booked session is live, and the interview room shows an on-screen indicator while recording is active.',
          'Recordings are captured on the server as a single video file of the session and stored in private cloud storage.',
          'Both participants of that session can download the recording through short-lived links and may save a copy to their own device. Copies saved to a personal device are outside our control.',
          'In-room chat messages are visible to both participants. Interview notes are private to the participant who wrote them.',
        ),
        pending(
          'Whether explicit consent from both participants is required before recording starts, and the retention period after which recordings, chat, and notes are deleted.',
        ),
      ],
    },
    {
      id: 'ai-processing',
      heading: 'AI processing',
      blocks: [
        p(
          'When a candidate uses AI-assisted interviewer matching, the public details of listed interviewers (such as headline, current role and company, experience, skills, languages, target roles, and services) are sent to a third-party AI model provider to rank suitable interviewers. Contact details are not part of this request.',
        ),
        p(
          'Candidates can also use AI features for themselves. Resume text a candidate submits for skill analysis is sent to the AI model provider. During AI Practice, the candidate’s microphone audio and answers are streamed to OpenAI’s real-time voice service; if that is unavailable, the browser’s own speech recognition is used, which some browsers process through their vendor’s service.',
        ),
        p(
          'Live interviews between candidates and interviewers, including their audio and video, recordings, in-room chat, and interview notes, are not processed by AI in the current version of the Service.',
        ),
        pending('Name of the AI model provider for matching and resume analysis, its data-use and retention terms, and whether users can opt out of AI processing.'),
      ],
    },
    {
      id: 'how-we-use',
      heading: 'How we use information',
      blocks: [
        list(
          'To create and secure your account and keep you signed in.',
          'To publish interviewer profiles, services, and availability to candidates.',
          'To create, confirm, reschedule, cancel, and run bookings and interview sessions.',
          'To review interviewer verification and moderate reviews.',
          'To send notifications about bookings and sessions.',
          'To calculate fees and show booking and earnings records.',
          'To investigate problems, prevent misuse, and meet legal obligations.',
        ),
      ],
    },
    {
      id: 'sharing',
      heading: 'Who can see your information',
      blocks: [
        list(
          'Candidates can see listed interviewer profiles, services, prices, availability, and published reviews.',
          'Your interview counterpart can see your name, the session, shared chat, and any recording of that session. Interviewer feedback is visible to the candidate, except fields marked as internal notes.',
          'Our administrators can access records needed to operate, verify, and moderate the Service.',
          'Service providers that host and run the Service process data on our behalf: Supabase (database, authentication, file storage, and server functions), LiveKit (real-time audio, video, and recording), Vercel (website hosting), Google (if you choose Google sign-in), an AI model provider (for AI matching and resume analysis), and OpenAI (for AI Practice voice sessions).',
          'Authorities, where required by law.',
        ),
        pending('Email and WhatsApp notification delivery providers, and any payment gateway once connected.'),
      ],
    },
    {
      id: 'storage-transfers',
      heading: 'Where data is stored',
      blocks: [
        p(
          'The Service’s database and file storage, including recordings, are hosted by Supabase in its Asia-Pacific (Tokyo, Japan) region. Other service providers may process data in other countries.',
        ),
        pending('Cross-border transfer disclosures required under applicable data protection law.'),
      ],
    },
    {
      id: 'browser-storage',
      heading: 'Cookies and browser storage',
      blocks: [
        p(
          'The Service uses your browser’s storage to keep you signed in and to remember in-app preferences. The Service does not use advertising or analytics trackers. If you use Google sign-in, Google may set its own cookies under its own policies.',
        ),
      ],
    },
    {
      id: 'retention',
      heading: 'Retention',
      blocks: [
        p(
          'Account, profile, booking, and session records are kept while your account is active. The Service does not currently delete recordings, chat, notes, or booking history automatically after a set period.',
        ),
        pending('Retention periods for each category of data, including recordings, payment records, and data kept after account deletion.'),
      ],
    },
    {
      id: 'account-deletion',
      heading: 'Account deletion',
      blocks: [
        p('Interviewers can delete their account from Settings by typing the confirmation word. Deletion is blocked while an interview is in progress. When an interviewer account is deleted:'),
        list(
          'Open bookings are cancelled and the affected candidates are notified.',
          'Availability, skills, verification records, and feedback you wrote are removed, along with services that have no booking history.',
          'If booking history or reviews exist, your profile is anonymised and unlisted instead of being fully erased, so the other party’s records stay consistent.',
          'Recordings, shared chat, and notes from past sessions remain linked to those sessions.',
        ),
        p('Candidates can delete their account from the candidate app by typing the confirmation word. Deletion also clears data the app saved in that browser.'),
        pending('How long anonymised records and past session data are kept after deletion, and how a participant can request their removal.'),
      ],
    },
    {
      id: 'your-rights',
      heading: 'Your choices and data requests',
      blocks: [
        p(
          'You can view and correct most of your information from your profile and settings pages, and delete your account from within the app. Interviewers can also unlist their profile. For other requests, such as a copy of your data, correction of records you cannot edit, removal of a recording, or withdrawal of consent, contact us using the details on the Contact Us page.',
        ),
        pending('Request channel, identity checks, response timelines, and the grievance redressal process.'),
      ],
    },
    {
      id: 'security',
      heading: 'Security',
      blocks: [
        p(
          'Access to data is restricted by account role and booking participation, recordings are kept in private storage and shared only through short-lived links, and connections to the Service are encrypted in transit. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.',
        ),
      ],
    },
    {
      id: 'children',
      heading: 'Eligibility',
      blocks: [pending('Minimum age to use the Service and how data of underage users is handled.')],
    },
    effectiveDateSection,
  ],
}

const terms: LegalDocument = {
  slug: 'terms',
  path: '/terms',
  title: 'Terms of Service',
  footerLabel: 'Terms of Service',
  summary: `The terms that apply when you use ${LEGAL_PRODUCT_NAME}, operated by ${LEGAL_COMPANY_NAME}.`,
  sections: [
    {
      id: 'agreement',
      heading: 'Agreement',
      blocks: [
        p(
          `These terms govern your use of ${LEGAL_PRODUCT_NAME} (the “Service”), operated by ${LEGAL_COMPANY_NAME}. By creating an account or using the Service, you agree to these terms, the Privacy Policy, the Refund & Cancellation Policy, and the Pricing & Billing Terms.`,
        ),
        pending('Final legal review of these terms, including eligibility and minimum age.'),
      ],
    },
    {
      id: 'service',
      heading: 'The Service',
      blocks: [
        p(
          'The Service is a platform where candidates book mock interviews and related sessions with independent professional interviewers. Interviewers set their own services, prices, and availability. We provide the booking, interview room, recording, feedback, and review tools.',
        ),
        pending('Legal relationship between the company and interviewers (for example, independent professional or contractor) and any interviewer agreement.'),
      ],
    },
    {
      id: 'accounts',
      heading: 'Accounts',
      blocks: [
        list(
          'Provide accurate information and keep it up to date.',
          'Keep your sign-in credentials secure; you are responsible for activity on your account.',
          'Interviewer, candidate, and administrator accounts are separate. Use each account only in its own application.',
        ),
      ],
    },
    {
      id: 'interviewer-obligations',
      heading: 'Interviewer profiles and verification',
      blocks: [
        list(
          'Your profile, current company and role, experience, and skills must be truthful.',
          'Administrators review profiles and set verification statuses. We may decline, revoke, or unlist a profile that cannot be verified or breaks these terms.',
          'Verification badges reflect our review; they do not guarantee identity, employment, or expertise.',
        ),
      ],
    },
    {
      id: 'bookings',
      heading: 'Bookings and sessions',
      blocks: [
        list(
          'A booking is held for 10 minutes while payment is completed; unpaid holds expire and the slot is released.',
          'After payment, the interviewer accepts or declines the request. Accepted bookings are confirmed for both parties.',
          'Participants can enter the interview room from 15 minutes before the scheduled start until 15 minutes after it. A session can be recorded as a no-show for a participant who does not join in that window.',
          'Cancellations, reschedules, and refunds follow the Refund & Cancellation Policy.',
        ),
      ],
    },
    {
      id: 'recordings-content',
      heading: 'Recordings, chat, notes, and feedback',
      blocks: [
        list(
          'Either participant can record a live session. Recordings are available to both participants of that session.',
          'You are responsible for any recording, note, or chat content you download or share outside the Service.',
          'Interviewer feedback is shared with the candidate, except internal notes. Candidate reviews are published after administrator moderation.',
        ),
        pending('Rules on recording consent, permitted use of recordings, and ownership and licence of session content and feedback.'),
      ],
    },
    {
      id: 'conduct',
      heading: 'Conduct',
      blocks: [
        p(
          'Use the Service lawfully and professionally. Do not harass other users, misrepresent yourself, share another user’s personal data without permission, or attempt to bypass the Service’s access controls.',
        ),
        pending('Full acceptable-use policy, including off-platform payments and enforcement steps.'),
      ],
    },
    {
      id: 'fees',
      heading: 'Fees and payouts',
      blocks: [p('Session fees, platform fees, and payouts are described in the Pricing & Billing Terms.')],
    },
    {
      id: 'termination',
      heading: 'Suspension and account deletion',
      blocks: [
        p(
          'You can delete your account from within the app at any time. Interviewer accounts cannot be deleted while an interview is in progress. The effects of deletion are described in the Privacy Policy.',
        ),
        pending('Grounds and process for suspending or terminating accounts, and the treatment of pending bookings and earnings.'),
      ],
    },
    {
      id: 'liability',
      heading: 'Disclaimers and liability',
      blocks: [
        p(
          'The Service does not guarantee interview outcomes, job offers, or uninterrupted availability of audio, video, or recording.',
        ),
        pending('Limitation of liability, indemnity, governing law, jurisdiction, and dispute resolution.'),
      ],
    },
    effectiveDateSection,
  ],
}

const refundPolicy: LegalDocument = {
  slug: 'refund-policy',
  path: '/refund-policy',
  title: 'Refund & Cancellation Policy',
  footerLabel: 'Refund & Cancellation Policy',
  summary: 'How booking holds, cancellations, reschedules, declines, no-shows, and refunds work on the Service today.',
  sections: [
    {
      id: 'payment-holds',
      heading: 'Payment holds',
      blocks: [
        p(
          'When a candidate books a session, the slot is held for 10 minutes while payment is completed. If payment is not completed in time, the hold expires, the slot is released, and nothing is charged.',
        ),
      ],
    },
    {
      id: 'cancellations',
      heading: 'Cancellations',
      blocks: [
        list(
          'The candidate or the interviewer can cancel a booking while it is awaiting payment, awaiting interviewer acceptance, or confirmed. The other party is notified.',
          'The Service does not currently apply a cancellation deadline or cancellation fee.',
        ),
        pending('Cancellation deadlines, any cancellation fee, and consequences for repeated interviewer cancellations.'),
      ],
    },
    {
      id: 'declines',
      heading: 'Interviewer declines',
      blocks: [
        p(
          'An interviewer can decline a paid booking request before accepting it. The candidate is notified that a refund will be processed.',
        ),
      ],
    },
    {
      id: 'reschedules',
      heading: 'Reschedules',
      blocks: [
        list(
          'The candidate or the interviewer can reschedule a booking that is awaiting acceptance or confirmed, to another available slot of the same interviewer.',
          'The fee paid carries over to the new time; no new payment is taken.',
          'When a candidate reschedules, the interviewer must accept the new time again.',
        ),
      ],
    },
    {
      id: 'no-shows',
      heading: 'No-shows',
      blocks: [
        p(
          'Participants can join from 15 minutes before the scheduled start until 15 minutes after it. A participant who does not join in that window can be recorded as a no-show.',
        ),
        pending('Refund and payout outcome for candidate no-shows, interviewer no-shows, and sessions interrupted by technical problems.'),
      ],
    },
    {
      id: 'refunds',
      heading: 'Refunds',
      blocks: [
        p(
          'Refunds are not issued automatically by the Service. Where a refund applies, it is processed separately to the original payment method.',
        ),
        pending('Refund eligibility for each case, whether the platform fee is refundable, refund timelines, and how to request a refund.'),
      ],
    },
    effectiveDateSection,
  ],
}

const pricing: LegalDocument = {
  slug: 'pricing',
  path: '/pricing',
  title: 'Pricing & Billing Terms',
  footerLabel: 'Pricing & Billing Terms',
  summary: 'How session fees, platform fees, payments, and interviewer earnings are calculated on the Service.',
  sections: [
    {
      id: 'session-fees',
      heading: 'Session fees',
      blocks: [
        p(
          'Each interviewer sets the price and duration of their own services. Prices are shown in Indian Rupees (INR). The fee is fixed on a booking when it is created; later price changes apply only to new bookings.',
        ),
      ],
    },
    {
      id: 'platform-fee',
      heading: 'Platform fee',
      blocks: [
        p(
          'A platform fee is charged on each booking: the greater of ₹49 or 5% of the session fee. The total charged at booking is the session fee plus the platform fee.',
        ),
        pending('Whether the platform fee is borne by the candidate, the interviewer, or both. The interviewer Earnings page currently shows net earnings as the session fee minus the platform fee.'),
      ],
    },
    {
      id: 'payments',
      heading: 'Payments',
      blocks: [
        p(
          'A payment gateway is not yet connected to the Service. Bookings currently move from payment to the interviewer’s acceptance step through a placeholder payment confirmation, and no card or bank details are collected by the Service.',
        ),
        pending('Payment gateway provider, accepted payment methods, taxes (including GST), and invoices or receipts.'),
      ],
    },
    {
      id: 'earnings-payouts',
      heading: 'Interviewer earnings and payouts',
      blocks: [
        p(
          'The Earnings page shows completed-session fees, platform fees, and net amounts for your records. Payouts are not processed inside the Service.',
        ),
        pending('Payout method, schedule, minimum payout, tax deductions, and treatment of refunds and no-shows on payouts.'),
      ],
    },
    effectiveDateSection,
  ],
}

const contact: LegalDocument = {
  slug: 'contact',
  path: '/contact',
  title: 'Contact Us',
  footerLabel: 'Contact Us',
  summary: `How to reach ${LEGAL_COMPANY_NAME} about ${LEGAL_PRODUCT_NAME}.`,
  sections: [
    {
      id: 'company',
      heading: 'Company',
      blocks: [
        p(`${LEGAL_PRODUCT_NAME} is operated by ${LEGAL_COMPANY_NAME}.`),
        pending('Registered office address, corporate identification number, support email, and phone number.'),
      ],
    },
    {
      id: 'support',
      heading: 'Support, refunds, and data requests',
      blocks: [
        p(
          'Use this channel for help with your account, bookings, refunds, verification, recordings, or privacy and data requests.',
        ),
        pending('Support and data-request contact channel and expected response times.'),
      ],
    },
    {
      id: 'grievance',
      heading: 'Grievance officer',
      blocks: [pending('Name, designation, and contact details of the grievance officer.')],
    },
    {
      id: 'in-app',
      heading: 'In the app',
      blocks: [
        list(
          'Update your profile and notification preferences from your profile and settings pages.',
          'Delete your account from within the app.',
          'Share feedback about the Service after an interview.',
        ),
      ],
    },
  ],
}

export const LEGAL_DOCUMENTS: readonly LegalDocument[] = [privacy, terms, refundPolicy, pricing, contact]

export function getLegalDocument(slug: LegalSlug): LegalDocument {
  const document = LEGAL_DOCUMENTS.find((item) => item.slug === slug)
  if (!document) throw new Error(`Unknown legal document: ${slug}`)
  return document
}
