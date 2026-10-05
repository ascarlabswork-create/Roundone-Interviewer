/**
 * Interview timing model (mirrors the server rules in private.interview_call_context):
 * lobby opens 30 minutes before the start (device checks), LiveKit join opens 15 minutes
 * before the start, the interview officially starts at starts_at, new entry closes 15
 * minutes after the start, and the call ends at start + service duration. The server clock
 * is authoritative; the client only uses this to render the right screen and countdowns.
 */
export const LOBBY_LEAD_MINUTES = 30
export const CALL_OPEN_LEAD_MINUTES = 15
export const LATE_JOIN_GRACE_MINUTES = 15

const MINUTE_MS = 60_000

export type InterviewSchedule = {
  lobbyOpensAt: number
  callOpensAt: number
  startsAt: number
  joinDeadline: number
  endsAt: number
}

export type InterviewPhase = 'scheduled' | 'lobby' | 'live' | 'ended'

export type InterviewRoomAccess = 'not_open' | 'early' | 'started' | 'join_closed' | 'ended'

export function interviewSchedule(startsAtIso: string, durationMin: number): InterviewSchedule | null {
  const startsAt = Date.parse(startsAtIso)
  if (Number.isNaN(startsAt) || !Number.isFinite(durationMin) || durationMin <= 0) return null
  const endsAt = startsAt + durationMin * MINUTE_MS
  return {
    lobbyOpensAt: startsAt - LOBBY_LEAD_MINUTES * MINUTE_MS,
    callOpensAt: startsAt - CALL_OPEN_LEAD_MINUTES * MINUTE_MS,
    startsAt,
    joinDeadline: Math.min(startsAt + LATE_JOIN_GRACE_MINUTES * MINUTE_MS, endsAt),
    endsAt,
  }
}

export function interviewPhase(schedule: InterviewSchedule, nowMs: number): InterviewPhase {
  if (nowMs >= schedule.endsAt) return 'ended'
  if (nowMs >= schedule.startsAt) return 'live'
  if (nowMs >= schedule.lobbyOpensAt) return 'lobby'
  return 'scheduled'
}

/** New entry is allowed from 15 minutes before the start until the late-join deadline; someone who already joined may reconnect until the end. */
export function canEnterCall(schedule: InterviewSchedule, nowMs: number, alreadyJoined: boolean) {
  if (nowMs < schedule.callOpensAt || nowMs >= schedule.endsAt) return false
  return alreadyJoined || nowMs <= schedule.joinDeadline
}

export function isLobbyOpen(schedule: InterviewSchedule, nowMs: number) {
  const phase = interviewPhase(schedule, nowMs)
  return phase === 'lobby' || phase === 'live'
}

export function interviewRoomAccess(
  schedule: InterviewSchedule,
  nowMs: number,
  alreadyJoined: boolean,
): InterviewRoomAccess {
  if (nowMs >= schedule.endsAt) return 'ended'
  if (nowMs < schedule.callOpensAt) return 'not_open'
  if (nowMs < schedule.startsAt) return 'early'
  if (alreadyJoined || nowMs <= schedule.joinDeadline) return 'started'
  return 'join_closed'
}

export function interviewRoomStatusCopy(access: InterviewRoomAccess, roomOpensAtCopy: string) {
  if (access === 'not_open') return `Interview room opens at ${roomOpensAtCopy}.`
  if (access === 'early') return 'Interview room is open. You can join early and wait for the other participant.'
  if (access === 'started') return 'Interview has started.'
  return 'No new participants can join.'
}

/** `1:05:09` above an hour, `05:09` below. */
export function formatCountdown(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const mmss = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  return hours > 0 ? `${hours}:${mmss}` : mmss
}

/** Milliseconds to add to the local clock to get the server clock, from one request round trip. */
export function serverClockOffset(serverNowIso: string, requestStartedMs: number, responseReceivedMs: number) {
  const serverNow = Date.parse(serverNowIso)
  if (Number.isNaN(serverNow)) return 0
  return serverNow - (requestStartedMs + responseReceivedMs) / 2
}
