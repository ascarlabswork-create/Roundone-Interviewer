import { describe, expect, it } from 'vitest'
import { fileSafeName, interviewFileName } from './saveToComputer.ts'

describe('fileSafeName', () => {
  it('strips characters that cannot be used in Windows file names', () => {
    expect(fileSafeName('Priya / Sharma: round 1?')).toBe('Priya Sharma round 1')
  })

  it('falls back when the name is empty', () => {
    expect(fileSafeName('   ')).toBe('interview')
  })
})

describe('interviewFileName', () => {
  it('builds a dated recording file name', () => {
    expect(interviewFileName('recording', 'Asha Patel', '2026-10-09T08:00:00.000Z')).toBe(
      'interview-recording-Asha Patel-2026-10-09.mp4',
    )
  })

  it('builds a dated notes file name', () => {
    expect(interviewFileName('notes', 'Asha Patel', '2026-10-09T08:00:00.000Z')).toBe(
      'interview-notes-Asha Patel-2026-10-09.txt',
    )
  })
})
