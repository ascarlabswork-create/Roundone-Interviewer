import { describe, expect, it } from 'vitest'
import { parseInterviewMessage } from './interviewMessages.ts'
import { parseInterviewNotes } from './interviewNotes.ts'
import { parseInterviewAppFeedback } from './interviewAppFeedback.ts'
import { parseInterviewRecordingRow } from './interviewRecording.ts'

const SESSION = '11111111-1111-4111-8111-111111111111'
const USER = '99999999-9999-4999-8999-999999999999'

describe('interview room extras parsers', () => {
  it('reads a chat message for the current session', () => {
    expect(
      parseInterviewMessage({
        id: '33333333-3333-4333-8333-333333333333',
        interview_session_id: SESSION,
        sender_user_id: USER,
        message: 'Ready when you are',
        created_at: '2026-10-07T08:00:00.000Z',
      }),
    ).toEqual({
      id: '33333333-3333-4333-8333-333333333333',
      sessionId: SESSION,
      senderUserId: USER,
      message: 'Ready when you are',
      createdAt: '2026-10-07T08:00:00.000Z',
    })
    expect(parseInterviewMessage({ interview_session_id: SESSION })).toBeNull()
  })

  it('reads private notes', () => {
    expect(
      parseInterviewNotes({
        id: '44444444-4444-4444-8444-444444444444',
        interview_session_id: SESSION,
        notes: 'Strong communication',
        updated_at: '2026-10-07T08:01:00.000Z',
      })?.notes,
    ).toBe('Strong communication')
  })

  it('reads private app feedback', () => {
    const row = parseInterviewAppFeedback({
      id: '55555555-5555-4555-8555-555555555555',
      interview_session_id: SESSION,
      rating: 4,
      feedback: 'Clear lobby',
      suggestions: '',
      updated_at: '2026-10-07T08:02:00.000Z',
    })
    expect(row?.rating).toBe(4)
    expect(row?.feedback).toBe('Clear lobby')
  })

  it('reads recording status without requiring storage paths', () => {
    expect(
      parseInterviewRecordingRow({
        id: '66666666-6666-4666-8666-666666666666',
        status: 'recording',
        started_at: '2026-10-07T08:03:00.000Z',
        stopped_at: null,
      }),
    ).toMatchObject({ status: 'recording', unconfigured: false, storagePath: null })
  })

  it('exposes a stopped recording that can be saved', () => {
    expect(
      parseInterviewRecordingRow({
        id: '66666666-6666-4666-8666-666666666666',
        status: 'stopped',
        started_at: '2026-10-07T08:03:00.000Z',
        stopped_at: '2026-10-07T08:20:00.000Z',
        storage_path: 'interviews/11111111-1111-4111-8111-111111111111/file.mp4',
      }),
    ).toMatchObject({
      status: 'stopped',
      storagePath: 'interviews/11111111-1111-4111-8111-111111111111/file.mp4',
    })
  })
})
