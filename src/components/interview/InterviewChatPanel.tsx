import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { INTERVIEW_MESSAGE_MAX_LENGTH } from '../../lib/interviewRoomExtras.ts'
import type { InterviewChatMessage } from '../../services/interviewMessages.ts'
import { Button } from '../ui/Button.tsx'

export function InterviewChatPanel({
  selfUserId,
  candidateName,
  messages,
  sending,
  error,
  onSend,
}: {
  selfUserId: string | null
  candidateName: string
  messages: InterviewChatMessage[]
  sending: boolean
  error: string | null
  onSend: (message: string) => Promise<void>
}) {
  const [draft, setDraft] = useState('')
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  async function submit() {
    const next = draft
    try {
      await onSend(next)
      setDraft('')
    } catch {
      // Error is shown from the hook.
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    void submit()
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void submit()
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-white text-slate-800">
      <div className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-navy-950">Chat</h2>
        <p className="text-xs text-slate-500">Only you and {candidateName} can see this.</p>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <p className="text-sm text-slate-500">No messages yet. Say hello when you are ready.</p>
        ) : (
          messages.map((item) => {
            const mine = item.senderUserId === selfUserId
            return (
              <div key={item.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                    mine ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-800'
                  }`}
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">
                    {mine ? 'You' : candidateName}
                  </p>
                  <p className="whitespace-pre-wrap break-words">{item.message}</p>
                </div>
              </div>
            )
          })
        )}
        <div ref={endRef} />
      </div>
      <form onSubmit={onSubmit} className="border-t border-slate-200 p-3">
        <textarea
          value={draft}
          onChange={(event) => setDraft(event.target.value.slice(0, INTERVIEW_MESSAGE_MAX_LENGTH))}
          onKeyDown={onKeyDown}
          rows={2}
          maxLength={INTERVIEW_MESSAGE_MAX_LENGTH}
          placeholder="Message the candidate…"
          className="w-full rounded-lg border border-slate-200 p-2 text-sm"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <p className="text-xs text-slate-500">Enter to send · Shift+Enter for a new line</p>
          <Button type="submit" size="sm" disabled={sending || !draft.trim()}>
            Send
          </Button>
        </div>
        {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      </form>
    </div>
  )
}
