-- Interview timing lifecycle, enforced on the server clock:
--   starts_at - 30 min  pre-interview lobby (device checks only, no call access)
--   starts_at           call entry opens
--   starts_at + 15 min  late-join deadline: no new entry; participants who already joined may reconnect
--   ends_at             scheduled end (starts_at + service duration); never extended
-- Shared by the Interviewer and Candidate apps through create-interview-token and the call RPCs.

-- Participant authorization and timing facts, without any timing rule.
CREATE OR REPLACE FUNCTION private.interview_call_access(p_booking_id uuid, p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_session public.interview_sessions%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
  v_role text;
  v_user uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_booking_id IS NULL AND p_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  IF p_session_id IS NOT NULL THEN
    SELECT * INTO v_session FROM public.interview_sessions AS sessions WHERE sessions.id = p_session_id;
  ELSE
    SELECT * INTO v_session FROM public.interview_sessions AS sessions WHERE sessions.booking_id = p_booking_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF p_booking_id IS NOT NULL AND v_session.booking_id IS DISTINCT FROM p_booking_id THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_booking FROM public.bookings AS bookings WHERE bookings.id = v_session.booking_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;

  IF private.owns_candidate_profile(v_booking.candidate_profile_id) THEN
    v_role := 'candidate';
  ELSIF private.owns_interviewer_profile(v_booking.interviewer_profile_id) THEN
    v_role := 'interviewer';
  ELSE
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'session_id', v_session.id,
    'booking_id', v_booking.id,
    'role', v_role,
    'room_name', private.interview_room_name(v_session.id),
    'participant_identity', v_role || ':' || v_user::text,
    'status', v_booking.status,
    'lobby_opens_at', v_booking.starts_at - interval '30 minutes',
    'starts_at', v_booking.starts_at,
    'join_deadline', LEAST(v_booking.starts_at + interval '15 minutes', v_booking.ends_at),
    'ends_at', v_booking.ends_at,
    'duration_min', v_booking.duration_min,
    'session_started_at', v_session.started_at,
    'session_ended_at', v_session.ended_at,
    'has_joined', EXISTS (
      SELECT 1
      FROM public.session_events AS events
      WHERE events.session_id = v_session.id
        AND events.event_type = 'participant_joined'
        AND events.actor_profile_id = v_user
    )
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.interview_call_access(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Call entry: confirmed booking, server time inside the entry window, scheduled end not reached.
CREATE OR REPLACE FUNCTION private.interview_call_context(p_booking_id uuid, p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_access jsonb;
  v_now timestamptz := now();
BEGIN
  v_access := private.interview_call_access(p_booking_id, p_session_id);

  IF v_access->>'status' NOT IN ('confirmed', 'in_progress') THEN
    RAISE EXCEPTION 'booking_not_confirmed' USING ERRCODE = '42501';
  END IF;

  IF v_access->>'session_ended_at' IS NOT NULL OR v_now >= (v_access->>'ends_at')::timestamptz THEN
    RAISE EXCEPTION 'session_expired' USING ERRCODE = '42501';
  END IF;

  IF v_now < (v_access->>'starts_at')::timestamptz THEN
    RAISE EXCEPTION 'interview_not_started' USING ERRCODE = '42501';
  END IF;

  IF v_now > (v_access->>'join_deadline')::timestamptz AND NOT (v_access->>'has_joined')::boolean THEN
    RAISE EXCEPTION 'join_deadline_passed' USING ERRCODE = '42501';
  END IF;

  RETURN v_access;
END;
$function$;

REVOKE ALL ON FUNCTION private.interview_call_context(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Joining is gated by the entry window; leave/end events stay recordable after the call;
-- lobby presence is recordable from the lobby opening until the scheduled end.
CREATE OR REPLACE FUNCTION public.record_interview_call_event(p_session_id uuid, p_event text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_access jsonb;
  v_event text;
  v_now timestamptz := now();
BEGIN
  v_event := lower(btrim(COALESCE(p_event, '')));
  IF v_event NOT IN ('participant_joined', 'participant_left', 'call_ended', 'lobby_entered') THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;

  IF v_event = 'participant_joined' THEN
    v_access := private.interview_call_context(NULL, p_session_id);
  ELSE
    v_access := private.interview_call_access(NULL, p_session_id);
  END IF;

  IF v_event = 'lobby_entered' THEN
    IF v_access->>'status' NOT IN ('confirmed', 'in_progress')
       OR v_access->>'session_ended_at' IS NOT NULL
       OR v_now < (v_access->>'lobby_opens_at')::timestamptz
       OR v_now >= (v_access->>'ends_at')::timestamptz THEN
      RAISE EXCEPTION 'lobby_not_open' USING ERRCODE = '42501';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.session_events AS events
      WHERE events.session_id = (v_access->>'session_id')::uuid
        AND events.event_type = 'lobby_entered'
        AND events.actor_profile_id = auth.uid()
    ) THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.session_events (session_id, event_type, actor_profile_id, payload)
  VALUES ((v_access->>'session_id')::uuid, v_event, auth.uid(), jsonb_build_object('role', v_access->>'role'));
END;
$function$;

-- Server-clock timing and participant status for the interview page.
CREATE OR REPLACE FUNCTION public.get_interview_timing(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_access jsonb;
  v_now timestamptz := now();
  v_phase text;
  v_candidate_last text;
  v_admission text;
  v_no_show text;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  v_access := private.interview_call_access(NULL, p_session_id);

  v_phase := CASE
    WHEN v_access->>'status' NOT IN ('confirmed', 'in_progress') THEN 'closed'
    WHEN v_access->>'session_ended_at' IS NOT NULL OR v_now >= (v_access->>'ends_at')::timestamptz THEN 'ended'
    WHEN v_now < (v_access->>'lobby_opens_at')::timestamptz THEN 'scheduled'
    WHEN v_now < (v_access->>'starts_at')::timestamptz THEN 'lobby'
    ELSE 'live'
  END;

  SELECT events.event_type INTO v_candidate_last
  FROM public.session_events AS events
  WHERE events.session_id = p_session_id
    AND events.event_type IN ('participant_joined', 'participant_left')
    AND events.payload->>'role' = 'candidate'
  ORDER BY events.created_at DESC
  LIMIT 1;

  SELECT admissions.status INTO v_admission
  FROM public.interview_admissions AS admissions
  WHERE admissions.session_id = p_session_id;

  SELECT events.payload->>'absent_role' INTO v_no_show
  FROM public.session_events AS events
  WHERE events.session_id = p_session_id
    AND events.event_type IN ('candidate_no_show', 'interviewer_no_show')
  ORDER BY events.created_at DESC
  LIMIT 1;

  RETURN (v_access - 'room_name' - 'participant_identity') || jsonb_build_object(
    'server_now', v_now,
    'phase', v_phase,
    'can_join', v_phase = 'live'
      AND (v_now <= (v_access->>'join_deadline')::timestamptz OR (v_access->>'has_joined')::boolean),
    'candidate_joined', v_candidate_last IS NOT NULL,
    'candidate_presence', CASE v_candidate_last
      WHEN 'participant_joined' THEN 'in_call'
      WHEN 'participant_left' THEN 'left'
      ELSE NULL
    END,
    'candidate_in_lobby', EXISTS (
      SELECT 1 FROM public.session_events AS events
      WHERE events.session_id = p_session_id
        AND events.event_type = 'lobby_entered'
        AND events.payload->>'role' = 'candidate'
    ),
    'interviewer_joined', EXISTS (
      SELECT 1 FROM public.session_events AS events
      WHERE events.session_id = p_session_id
        AND events.event_type = 'participant_joined'
        AND events.payload->>'role' = 'interviewer'
    ),
    'admission', v_admission,
    'no_show_role', v_no_show
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.get_interview_timing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_interview_timing(uuid) TO authenticated, service_role;

-- A participant who joined records that the other side missed the late-join deadline.
-- Ends the session and moves the booking to no_show; payments are untouched.
CREATE OR REPLACE FUNCTION public.mark_interview_no_show(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_access jsonb;
  v_role text;
  v_absent text;
  v_booking public.bookings%ROWTYPE;
  v_session public.interview_sessions%ROWTYPE;
  v_candidate_profile uuid;
  v_interviewer_profile uuid;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'invalid_payload' USING ERRCODE = '22023';
  END IF;
  v_access := private.interview_call_access(NULL, p_session_id);
  v_role := v_access->>'role';
  v_absent := CASE WHEN v_role = 'interviewer' THEN 'candidate' ELSE 'interviewer' END;

  SELECT * INTO v_booking FROM public.bookings WHERE id = (v_access->>'booking_id')::uuid FOR UPDATE;
  SELECT * INTO v_session FROM public.interview_sessions WHERE id = p_session_id FOR UPDATE;

  IF v_booking.status NOT IN ('confirmed'::public.booking_status, 'in_progress'::public.booking_status)
     OR v_session.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  IF now() <= LEAST(v_booking.starts_at + interval '15 minutes', v_booking.ends_at) THEN
    RAISE EXCEPTION 'join_window_open' USING ERRCODE = 'P0001';
  END IF;

  IF NOT (v_access->>'has_joined')::boolean THEN
    RAISE EXCEPTION 'reporter_not_joined' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.session_events AS events
    WHERE events.session_id = p_session_id
      AND events.event_type = 'participant_joined'
      AND events.payload->>'role' = v_absent
  ) OR (
    v_absent = 'candidate' AND EXISTS (
      SELECT 1 FROM public.interview_admissions AS admissions
      WHERE admissions.session_id = p_session_id AND admissions.requested_at IS NOT NULL
    )
  ) THEN
    RAISE EXCEPTION 'participant_joined' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.interview_sessions
  SET ended_at = now()
  WHERE id = p_session_id;

  INSERT INTO public.session_events (session_id, event_type, actor_profile_id, payload)
  VALUES (
    p_session_id,
    v_absent || '_no_show',
    auth.uid(),
    jsonb_build_object(
      'absent_role', v_absent,
      'reported_by', v_role,
      'join_deadline', LEAST(v_booking.starts_at + interval '15 minutes', v_booking.ends_at)
    )
  );

  UPDATE public.bookings
  SET status = 'no_show'::public.booking_status
  WHERE id = v_booking.id;

  SELECT cp.profile_id INTO v_candidate_profile FROM public.candidate_profiles cp WHERE cp.id = v_booking.candidate_profile_id;
  SELECT ip.profile_id INTO v_interviewer_profile FROM public.interviewer_profiles ip WHERE ip.id = v_booking.interviewer_profile_id;

  IF v_absent = 'candidate' THEN
    PERFORM private.notify(v_candidate_profile, 'interview_no_show', 'Missed interview',
      'You did not join your interview before the join deadline.', jsonb_build_object('booking_id', v_booking.id));
    PERFORM private.notify(v_interviewer_profile, 'interview_no_show', 'Candidate did not join',
      'The candidate did not join before the join deadline. The interview was recorded as a no-show.',
      jsonb_build_object('booking_id', v_booking.id));
  ELSE
    PERFORM private.notify(v_interviewer_profile, 'interview_no_show', 'Missed interview',
      'You did not join this interview before the join deadline.', jsonb_build_object('booking_id', v_booking.id));
    PERFORM private.notify(v_candidate_profile, 'interview_no_show', 'Interviewer did not join',
      'Your interviewer did not join before the join deadline. The interview was recorded as a no-show.',
      jsonb_build_object('booking_id', v_booking.id));
  END IF;

  RETURN jsonb_build_object('booking_id', v_booking.id, 'absent_role', v_absent);
END;
$function$;

REVOKE ALL ON FUNCTION public.mark_interview_no_show(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_interview_no_show(uuid) TO authenticated, service_role;

-- An interview cannot be started or completed before its scheduled start (admins excepted).
CREATE OR REPLACE FUNCTION public.start_interview_session(p_booking_id uuid)
RETURNS interview_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_booking public.bookings;
  v_session public.interview_sessions;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.owns_interviewer_profile(v_booking.interviewer_profile_id) AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status NOT IN ('confirmed'::public.booking_status, 'in_progress'::public.booking_status) THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;
  IF now() < v_booking.starts_at AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'interview_not_started' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_session FROM public.interview_sessions WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  IF v_session.started_at IS NULL THEN
    UPDATE public.interview_sessions
    SET started_at = now()
    WHERE id = v_session.id
    RETURNING * INTO v_session;
    INSERT INTO public.session_events (session_id, event_type, actor_profile_id)
    VALUES (v_session.id, 'started', auth.uid());
  END IF;

  IF v_booking.status = 'confirmed'::public.booking_status THEN
    UPDATE public.bookings
    SET status = 'in_progress'::public.booking_status
    WHERE id = p_booking_id;
  END IF;

  RETURN v_session;
END;
$function$;

CREATE OR REPLACE FUNCTION public.complete_interview_session(p_booking_id uuid)
RETURNS interview_sessions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_booking public.bookings;
  v_session public.interview_sessions;
  v_interviewer uuid;
BEGIN
  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.owns_interviewer_profile(v_booking.interviewer_profile_id) AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;
  IF v_booking.status NOT IN ('confirmed'::public.booking_status, 'in_progress'::public.booking_status) THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;
  IF now() < v_booking.starts_at AND NOT private.is_admin() THEN
    RAISE EXCEPTION 'interview_not_started' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_session FROM public.interview_sessions WHERE booking_id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'session_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_session.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.interview_sessions
  SET
    started_at = COALESCE(started_at, now()),
    ended_at = now()
  WHERE id = v_session.id
  RETURNING * INTO v_session;

  INSERT INTO public.session_events (session_id, event_type, actor_profile_id)
  VALUES (v_session.id, 'completed', auth.uid());

  UPDATE public.bookings
  SET status = 'completed'::public.booking_status
  WHERE id = p_booking_id;

  SELECT profile_id INTO v_interviewer
  FROM public.interviewer_profiles
  WHERE id = v_booking.interviewer_profile_id;

  IF v_interviewer IS NOT NULL THEN
    PERFORM private.notify(
      v_interviewer,
      'interview_completed',
      'Interview completed',
      'This interview is marked complete. Submit private candidate feedback when ready.',
      jsonb_build_object('booking_id', p_booking_id)
    );
  END IF;

  RETURN v_session;
END;
$function$;
