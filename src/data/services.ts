import type { Service } from '../types.ts'

const DEFAULT_POLICY = 'Full refund if cancelled 24 hours before the session. 50% refund within 24 hours.'

export function makeService(
  id: string,
  name: string,
  interviewType: Service['interviewType'],
  durationMin: number,
  price: number,
  description: string,
  extra?: Partial<Service>,
): Service {
  return {
    id,
    name,
    interviewType,
    durationMin,
    price,
    description,
    candidateLevels: extra?.candidateLevels ?? ['SDE 2', 'Senior', 'Staff'],
    targetRoles: extra?.targetRoles ?? ['Software Engineer', 'Backend Engineer'],
    cancellationPolicy: extra?.cancellationPolicy ?? DEFAULT_POLICY,
    isActive: extra?.isActive ?? true,
  }
}

export const seedServices: Service[] = [
  makeService(
    'rahul-coding',
    'Coding Mock',
    'Coding',
    60,
    1000,
    'DSA round with follow-ups on complexity and trade-offs.',
  ),
  makeService(
    'rahul-sysdesign',
    'System Design Mock',
    'System Design',
    60,
    1500,
    'End-to-end design of a large-scale product, with diagrams and deep dives.',
  ),
  makeService(
    'rahul-behavioral',
    'Behavioral Mock',
    'Behavioral',
    45,
    800,
    'Leadership, conflict, and Google-style behavioral stories.',
    { targetRoles: ['Software Engineer', 'Backend Engineer'] },
  ),
  makeService(
    'rahul-full',
    'Full Interview',
    'System Design',
    90,
    2000,
    'Coding plus system design with a written scorecard.',
  ),
]
