import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listInterviewMessages,
  sendInterviewMessage,
  watchInterviewMessages,
  type InterviewChatMessage,
} from '../../services/interviewMessages.ts'

export function useInterviewChat(sessionId: string, selfUserId: string | null) {
  const [messages, setMessages] = useState<InterviewChatMessage[]>([])
  const [unread, setUnread] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const openRef = useRef(false)

  const setOpen = useCallback((open: boolean) => {
    openRef.current = open
    if (open) setUnread(0)
  }, [])

  useEffect(() => {
    let cancelled = false
    void listInterviewMessages(sessionId)
      .then((rows) => {
        if (!cancelled) setMessages(rows)
      })
      .catch((caught: unknown) => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'Could not load interview chat.')
      })
    const watch = watchInterviewMessages(sessionId, (message) => {
      setMessages((current) => (current.some((row) => row.id === message.id) ? current : [...current, message]))
      if (!openRef.current && message.senderUserId !== selfUserId) setUnread((count) => count + 1)
    })
    return () => {
      cancelled = true
      watch.unsubscribe()
    }
  }, [sessionId, selfUserId])

  const send = useCallback(
    async (raw: string) => {
      setSending(true)
      setError(null)
      try {
        const sent = await sendInterviewMessage(sessionId, raw)
        setMessages((current) => (current.some((row) => row.id === sent.id) ? current : [...current, sent]))
      } catch (caught: unknown) {
        setError(caught instanceof Error ? caught.message : 'Could not send this message.')
        throw caught
      } finally {
        setSending(false)
      }
    },
    [sessionId],
  )

  return { messages, unread, error, sending, send, setOpen }
}
