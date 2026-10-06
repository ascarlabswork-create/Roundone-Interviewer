import { type FormEvent, useEffect, useState } from 'react'
import { Button } from '../ui/Button.tsx'
import { Card, FieldLabel, TextArea } from '../ui/primitives.tsx'
import { cn } from '../../lib/cn.ts'
import {
  getMyInterviewAppFeedback,
  saveMyInterviewAppFeedback,
} from '../../services/interviewAppFeedback.ts'

export function AppFeedbackCard({ sessionId }: { sessionId: string }) {
  const [rating, setRating] = useState<number | null>(null)
  const [feedback, setFeedback] = useState('')
  const [suggestions, setSuggestions] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [skipped, setSkipped] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    void getMyInterviewAppFeedback(sessionId)
      .then((row) => {
        if (cancelled) return
        if (row) {
          setRating(row.rating)
          setFeedback(row.feedback ?? '')
          setSuggestions(row.suggestions ?? '')
          setSaved(true)
        }
        setLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [sessionId])

  if (!loaded || skipped) return null

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await saveMyInterviewAppFeedback(sessionId, { rating, feedback, suggestions })
      setSaved(true)
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Could not save RoundOne feedback.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-navy-950">How was your RoundOne interview experience?</h2>
      <p className="mt-1 text-sm text-slate-500">
        Optional product feedback. This is not your candidate evaluation, and the candidate cannot see it.
      </p>
      {saved ? (
        <p className="mt-3 text-sm text-emerald-800">Thanks — your RoundOne feedback was saved. You can update it below.</p>
      ) : null}
      <form onSubmit={onSubmit} className="mt-4 space-y-4">
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-slate-800">Overall experience</legend>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5].map((score) => (
              <button
                key={score}
                type="button"
                onClick={() => setRating(score)}
                className={cn(
                  'h-9 w-9 rounded-full text-sm font-semibold',
                  rating === score ? 'bg-navy-950 text-white' : 'bg-slate-100 text-slate-700',
                )}
              >
                {score}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <FieldLabel htmlFor="app-feedback">What should we improve?</FieldLabel>
          <TextArea id="app-feedback" value={feedback} onChange={(event) => setFeedback(event.target.value)} className="min-h-24" />
        </div>
        <div>
          <FieldLabel htmlFor="app-suggestions">Any bugs or suggestions?</FieldLabel>
          <TextArea
            id="app-suggestions"
            value={suggestions}
            onChange={(event) => setSuggestions(event.target.value)}
            className="min-h-24"
          />
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={busy}>
            {busy ? 'Saving…' : saved ? 'Update feedback' : 'Submit RoundOne feedback'}
          </Button>
          {!saved ? (
            <Button type="button" variant="outline" onClick={() => setSkipped(true)}>
              Skip
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  )
}
