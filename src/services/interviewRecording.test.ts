import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type InvokeResult = { data: unknown; error: unknown }

const fake = vi.hoisted(() => {
  const responses: InvokeResult[] = []
  const invoke = vi.fn(async () => responses.shift() ?? { data: null, error: null })
  return { responses, invoke, supabase: { functions: { invoke } } }
})

vi.mock('../lib/supabase.ts', () => ({ supabase: fake.supabase }))

const { RecordingNotReadyError, writeInterviewRecording } = await import('./interviewRecording.ts')

function notReady(): InvokeResult {
  const context = new Response(JSON.stringify({ error: 'recording_processing' }), { status: 409 })
  return { data: null, error: { message: 'Edge Function returned a non-2xx status code', context } }
}

describe('writeInterviewRecording', () => {
  const blob = new Blob(['video'])

  beforeEach(() => {
    vi.useFakeTimers()
    fake.responses.length = 0
    fake.invoke.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(blob)))
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('waits for the recording to finish processing before writing it', async () => {
    fake.responses.push(notReady(), notReady(), { data: { url: 'https://files.example/rec.mp4' }, error: null })
    const write = vi.fn(async () => {})

    const done = writeInterviewRecording('session-1', { write }, 60_000)
    await vi.runAllTimersAsync()
    await done

    expect(fake.invoke).toHaveBeenCalledTimes(3)
    expect(fake.invoke).toHaveBeenCalledWith('interview-recording', {
      body: { interview_session_id: 'session-1', action: 'save' },
    })
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('gives up without waiting when no wait time is allowed', async () => {
    fake.responses.push(notReady())
    const write = vi.fn(async () => {})

    await expect(writeInterviewRecording('session-1', { write })).rejects.toBeInstanceOf(RecordingNotReadyError)
    expect(fake.invoke).toHaveBeenCalledTimes(1)
    expect(write).not.toHaveBeenCalled()
  })
})
