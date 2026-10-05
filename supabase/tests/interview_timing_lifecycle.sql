-- Rollback-only verification of the interview timing lifecycle
-- (migrations 20261005093438_interview_timing_lifecycle and
-- 20261005094703_interview_late_join_deadline_any_status).
--
-- Creates a throwaway booking for an existing interviewer/candidate, moves its start time
-- relative to now() (constant inside the transaction) and calls the real RPCs as each user.
-- The block always ends with RAISE EXCEPTION 'RESULT: ...', so nothing is persisted.

CREATE OR REPLACE FUNCTION pg_temp.as_call(p_uid uuid, p_sql text) RETURNS text
LANGUAGE plpgsql AS $$
DECLARE
  v_result text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', p_uid::text, true);
  PERFORM set_config('role', 'authenticated', true);
  BEGIN
    EXECUTE p_sql INTO v_result;
  EXCEPTION WHEN OTHERS THEN
    v_result := 'ERR:' || SQLERRM;
  END;
  PERFORM set_config('role', 'none', true);
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  RETURN coalesce(v_result, 'ok');
END $$;

CREATE OR REPLACE FUNCTION pg_temp.check_result(p_label text, p_actual text, p_expected text) RETURNS text
LANGUAGE sql AS $$
  SELECT CASE WHEN coalesce(p_actual, '<null>') LIKE '%' || p_expected || '%'
    THEN 'PASS ' || p_label
    ELSE 'FAIL ' || p_label || ' (expected ' || p_expected || ', got ' || coalesce(p_actual, '<null>') || ')'
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.move_start(p_booking uuid, p_offset interval) RETURNS void
LANGUAGE sql AS $$
  UPDATE public.bookings
  SET starts_at = now() + p_offset, ends_at = now() + p_offset + make_interval(mins => duration_min)
  WHERE id = p_booking
$$;

DO $$
DECLARE
  v_interviewer_row uuid;
  v_candidate_row uuid;
  -- auth user ids (profiles.id), which is what auth.uid() returns
  v_interviewer uuid;
  v_other uuid;
  v_candidate uuid;
  v_service uuid;
  v_booking uuid;
  v_session uuid;
  r text[] := '{}';
  q_token text;
  q_begin text;
  q_timing text;
  q_no_show text;
BEGIN
  SELECT s.interviewer_profile_id, s.id, ip.profile_id INTO v_interviewer_row, v_service, v_interviewer
  FROM public.interviewer_services s
  JOIN public.interviewer_profiles ip ON ip.id = s.interviewer_profile_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.bookings b
    WHERE b.interviewer_profile_id = s.interviewer_profile_id
      AND b.status IN ('pending_payment', 'requested', 'confirmed', 'in_progress')
      AND tstzrange(b.starts_at, b.ends_at) && tstzrange(now() - interval '3 hours', now() + interval '2 days')
  )
  LIMIT 1;
  SELECT profile_id INTO v_other FROM public.interviewer_profiles WHERE id <> v_interviewer_row LIMIT 1;
  SELECT c.id, c.profile_id INTO v_candidate_row, v_candidate FROM public.candidate_profiles c
  WHERE c.profile_id <> v_interviewer AND NOT EXISTS (
    SELECT 1 FROM public.candidate_preferences p
    WHERE p.candidate_profile_id = c.id AND p.preferred_date IS NOT NULL
  )
  LIMIT 1;
  IF v_interviewer IS NULL OR v_other IS NULL OR v_candidate IS NULL THEN
    RAISE EXCEPTION 'RESULT: missing fixtures (interviewer %, other %, candidate %)', v_interviewer, v_other, v_candidate;
  END IF;

  INSERT INTO public.bookings (
    candidate_profile_id, interviewer_profile_id, service_id, status, starts_at, ends_at,
    display_timezone, interviewer_timezone, duration_min, session_fee_paise, platform_fee_paise, total_paise
  ) VALUES (
    v_candidate_row, v_interviewer_row, v_service, 'requested', now() + interval '1 day', now() + interval '1 day 30 minutes',
    'UTC', 'UTC', 30, 100000, 0, 100000
  ) RETURNING id INTO v_booking;

  -- 1. Accepting tomorrow's interview confirms it but opens nothing.
  r := r || pg_temp.check_result('accept → confirmed',
    pg_temp.as_call(v_interviewer, format('SELECT (public.confirm_booking(%L)).status::text', v_booking)), 'confirmed');
  SELECT id INTO v_session FROM public.interview_sessions WHERE booking_id = v_booking;
  q_token := format('SELECT public.prepare_interview_call(NULL, %L)::text', v_session);
  q_begin := format('SELECT public.begin_interview_call(%L)::text', v_session);
  q_timing := format('SELECT public.get_interview_timing(%L)->>''phase''', v_session);
  q_no_show := format('SELECT public.mark_interview_no_show(%L)::text', v_session);
  r := r || pg_temp.check_result('tomorrow: phase', pg_temp.as_call(v_interviewer, q_timing), 'scheduled');
  r := r || pg_temp.check_result('tomorrow: token denied', pg_temp.as_call(v_interviewer, q_token), 'interview_not_started');
  r := r || pg_temp.check_result('tomorrow: begin denied', pg_temp.as_call(v_interviewer, q_begin), 'interview_not_started');

  -- 2. Lobby opens 30 minutes early; still no call entry.
  PERFORM pg_temp.move_start(v_booking, interval '31 minutes');
  r := r || pg_temp.check_result('-31m: phase', pg_temp.as_call(v_interviewer, q_timing), 'scheduled');
  r := r || pg_temp.check_result('-31m: lobby closed',
    pg_temp.as_call(v_interviewer, format('SELECT public.record_interview_call_event(%L, ''lobby_entered'')::text', v_session)), 'lobby_not_open');
  PERFORM pg_temp.move_start(v_booking, interval '29 minutes');
  r := r || pg_temp.check_result('-29m: phase', pg_temp.as_call(v_interviewer, q_timing), 'lobby');
  r := r || pg_temp.check_result('-29m: lobby event',
    pg_temp.as_call(v_interviewer, format('SELECT public.record_interview_call_event(%L, ''lobby_entered'')::text || ''ok''', v_session)), 'ok');
  r := r || pg_temp.check_result('-29m: token denied', pg_temp.as_call(v_interviewer, q_token), 'interview_not_started');
  r := r || pg_temp.check_result('-29m: candidate token denied', pg_temp.as_call(v_candidate, q_token), 'interview_not_started');
  r := r || pg_temp.check_result('-29m: begin denied', pg_temp.as_call(v_interviewer, q_begin), 'interview_not_started');
  r := r || pg_temp.check_result('-29m: still confirmed',
    (SELECT status::text FROM public.bookings WHERE id = v_booking), 'confirmed');

  -- 9/10. Cancelled and superseded (rescheduled) bookings cannot start, even at start time.
  BEGIN
    PERFORM pg_temp.move_start(v_booking, interval '0');
    UPDATE public.bookings SET status = 'cancelled' WHERE id = v_booking;
    r := r || pg_temp.check_result('cancelled: token denied', pg_temp.as_call(v_interviewer, q_token), 'booking_not_confirmed');
    UPDATE public.bookings SET status = 'rescheduled', hold_expires_at = NULL WHERE id = v_booking;
    r := r || pg_temp.check_result('rescheduled: token denied', pg_temp.as_call(v_interviewer, q_token), 'booking_not_confirmed');
    RAISE EXCEPTION 'undo_scenario';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'undo_scenario' THEN RAISE; END IF;
  END;

  -- 11. Another interviewer can't use the session id.
  PERFORM pg_temp.move_start(v_booking, interval '0');
  r := r || pg_temp.check_result('other: token', pg_temp.as_call(v_other, q_token), 'not_authorized');
  r := r || pg_temp.check_result('other: timing', pg_temp.as_call(v_other, q_timing), 'not_authorized');
  r := r || pg_temp.check_result('other: begin', pg_temp.as_call(v_other, q_begin), 'not_authorized');
  r := r || pg_temp.check_result('other: no-show', pg_temp.as_call(v_other, q_no_show), 'not_authorized');

  -- 4. Interviewer joins at the start; this is what moves the booking to in_progress.
  r := r || pg_temp.check_result('start: phase', pg_temp.as_call(v_interviewer, q_timing), 'live');
  r := r || pg_temp.check_result('start: token', pg_temp.as_call(v_interviewer, q_token), 'room_name');
  r := r || pg_temp.check_result('start: token has scheduled end', pg_temp.as_call(v_interviewer, q_token), 'ends_at');
  r := r || pg_temp.check_result('start: begin', pg_temp.as_call(v_interviewer, q_begin), '{');
  r := r || pg_temp.check_result('start: in_progress',
    (SELECT status::text FROM public.bookings WHERE id = v_booking), 'in_progress');

  -- 5/6/8. Candidate joins within the grace period; the end is not extended.
  BEGIN
    PERFORM pg_temp.move_start(v_booking, interval '-14 minutes');
    r := r || pg_temp.check_result('+14m: no-show too early', pg_temp.as_call(v_interviewer, q_no_show), 'join_window_open');
    r := r || pg_temp.check_result('+14m: candidate token', pg_temp.as_call(v_candidate, q_token), 'room_name');
    r := r || pg_temp.check_result('+14m: candidate begin', pg_temp.as_call(v_candidate, q_begin), '{');
    PERFORM pg_temp.move_start(v_booking, interval '-20 minutes');
    r := r || pg_temp.check_result('+20m: candidate reconnect', pg_temp.as_call(v_candidate, q_token), 'room_name');
    r := r || pg_temp.check_result('+20m: no-show refused', pg_temp.as_call(v_interviewer, q_no_show), 'participant_joined');
    r := r || pg_temp.check_result('end not extended',
      pg_temp.as_call(v_interviewer, format(
        'SELECT extract(epoch FROM ((public.get_interview_timing(%L)->>''ends_at'')::timestamptz - (public.get_interview_timing(%L)->>''starts_at'')::timestamptz))::int::text',
        v_session, v_session)), '1800');
    PERFORM pg_temp.move_start(v_booking, interval '-30 minutes');
    r := r || pg_temp.check_result('end: interviewer token', pg_temp.as_call(v_interviewer, q_token), 'session_expired');
    r := r || pg_temp.check_result('end: candidate token', pg_temp.as_call(v_candidate, q_token), 'session_expired');
    r := r || pg_temp.check_result('end: phase', pg_temp.as_call(v_interviewer, q_timing), 'ended');
    r := r || pg_temp.check_result('end: complete',
      pg_temp.as_call(v_interviewer, format('SELECT (public.complete_interview_session(%L)).id::text', v_booking)), v_session::text);
    r := r || pg_temp.check_result('end: completed',
      (SELECT status::text FROM public.bookings WHERE id = v_booking), 'completed');
    RAISE EXCEPTION 'undo_scenario';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'undo_scenario' THEN RAISE; END IF;
  END;

  -- 7. After the deadline a candidate who never joined can't enter, even though the interviewer
  --    already started the call (in_progress); the interviewer records a no-show.
  PERFORM pg_temp.move_start(v_booking, interval '-16 minutes');
  r := r || pg_temp.check_result('+16m: candidate denied', pg_temp.as_call(v_candidate, q_token), 'join_window_closed');
  r := r || pg_temp.check_result('+16m: interviewer reconnect', pg_temp.as_call(v_interviewer, q_token), 'room_name');
  r := r || pg_temp.check_result('+16m: no-show', pg_temp.as_call(v_interviewer, q_no_show), 'candidate');
  r := r || pg_temp.check_result('no-show: status',
    (SELECT status::text FROM public.bookings WHERE id = v_booking), 'no_show');
  r := r || pg_temp.check_result('no-show: session ended',
    (SELECT (ended_at IS NOT NULL)::text FROM public.interview_sessions WHERE id = v_session), 'true');
  r := r || pg_temp.check_result('no-show: event',
    (SELECT count(*)::text FROM public.session_events WHERE session_id = v_session AND event_type = 'candidate_no_show'), '1');
  r := r || pg_temp.check_result('no-show: candidate token', pg_temp.as_call(v_candidate, q_token), 'booking_not_confirmed');

  RAISE EXCEPTION 'RESULT: % passed, % failed%', 
    (SELECT count(*) FROM unnest(r) x WHERE x LIKE 'PASS%'),
    (SELECT count(*) FROM unnest(r) x WHERE x LIKE 'FAIL%'),
    E'\n' || array_to_string(r, E'\n');
END $$;
