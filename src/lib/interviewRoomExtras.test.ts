import { describe, expect, it } from 'vitest'
import {
  isRecordingActive,
  parseRecordingStatus,
  validateAppFeedbackInput,
  validateInterviewMessage,
  validateInterviewNotes,
} from './interviewRoomExtras.ts'

describe('validateInterviewMessage', () => {
  it('rejects blank and whitespace-only messages', () => {
    expect(validateInterviewMessage('').ok).toBe(false)
    expect(validateInterviewMessage('   \n').ok).toBe(false)
  })

  it('trims a sendable message', () => {
    expect(validateInterviewMessage('  hello  ')).toEqual({ ok: true, message: 'hello' })
  })

  it('rejects messages over 2000 characters', () => {
    expect(validateInterviewMessage('a'.repeat(2001)).ok).toBe(false)
    expect(validateInterviewMessage('a'.repeat(2000)).ok).toBe(true)
  })
})

describe('validateInterviewNotes', () => {
  it('allows empty notes and rejects oversized notes', () => {
    expect(validateInterviewNotes('').ok).toBe(true)
    expect(validateInterviewNotes('n'.repeat(20_001)).ok).toBe(false)
  })
})

describe('validateAppFeedbackInput', () => {
  it('requires some content and a valid rating', () => {
    expect(validateAppFeedbackInput({ rating: null, feedback: '', suggestions: '' }).ok).toBe(false)
    expect(validateAppFeedbackInput({ rating: 0, feedback: 'ok', suggestions: '' }).ok).toBe(false)
    expect(validateAppFeedbackInput({ rating: 5, feedback: '  smooth  ', suggestions: '' })).toEqual({
      ok: true,
      rating: 5,
      feedback: 'smooth',
      suggestions: '',
    })
  })
})

describe('recording status', () => {
  it('treats starting/recording/stopping as active', () => {
    expect(isRecordingActive('recording')).toBe(true)
    expect(isRecordingActive('stopped')).toBe(false)
    expect(parseRecordingStatus('recording')).toBe('recording')
    expect(parseRecordingStatus('nope')).toBeNull()
  })
})
