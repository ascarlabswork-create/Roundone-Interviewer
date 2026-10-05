-- Interviewer profile, skills, availability date range and account deletion.

-- 1. Availability date range ---------------------------------------------------

ALTER TABLE public.interviewer_profiles
  ADD COLUMN IF NOT EXISTS available_from date,
  ADD COLUMN IF NOT EXISTS available_until date;

ALTER TABLE public.interviewer_profiles
  DROP CONSTRAINT IF EXISTS interviewer_profiles_available_range_check;

ALTER TABLE public.interviewer_profiles
  ADD CONSTRAINT interviewer_profiles_available_range_check
  CHECK (available_from IS NULL OR available_until IS NULL OR available_from <= available_until);

CREATE OR REPLACE FUNCTION private.tg_custom_slot_within_range()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_from date;
  v_until date;
BEGIN
  SELECT ip.available_from, ip.available_until
  INTO v_from, v_until
  FROM public.interviewer_profiles ip
  WHERE ip.id = NEW.interviewer_profile_id;

  IF (v_from IS NOT NULL AND NEW.on_date < v_from)
     OR (v_until IS NOT NULL AND NEW.on_date > v_until) THEN
    RAISE EXCEPTION 'custom_slot_outside_range' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS interviewer_custom_slots_within_range ON public.interviewer_custom_slots;
CREATE TRIGGER interviewer_custom_slots_within_range
  BEFORE INSERT OR UPDATE OF on_date, interviewer_profile_id ON public.interviewer_custom_slots
  FOR EACH ROW EXECUTE FUNCTION private.tg_custom_slot_within_range();

-- Slot generation: recurring windows and custom slots only produce slots on
-- local dates inside the interviewer's available range (NULL = open-ended).
-- create_booking / reschedule_booking validate against this function, so the
-- range is enforced for bookings too.
CREATE OR REPLACE FUNCTION private.list_bookable_slots(
  p_interviewer_profile_id uuid,
  p_service_id uuid,
  p_from timestamp with time zone DEFAULT now(),
  p_to timestamp with time zone DEFAULT NULL::timestamp with time zone
)
RETURNS TABLE(starts_at timestamp with time zone, ends_at timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_tz text;
  v_buffer integer;
  v_duration integer;
  v_listed boolean;
  v_active boolean;
  v_from timestamptz;
  v_to timestamptz;
  v_is_owner boolean;
  v_range_from date;
  v_range_until date;
BEGIN
  PERFORM private.expire_stale_holds(p_interviewer_profile_id);

  SELECT ip.timezone, ip.booking_buffer_min, ip.is_listed, p.is_active, s.duration_min,
         ip.available_from, ip.available_until
  INTO v_tz, v_buffer, v_listed, v_active, v_duration, v_range_from, v_range_until
  FROM public.interviewer_services s
  JOIN public.interviewer_profiles ip ON ip.id = s.interviewer_profile_id
  JOIN public.profiles p ON p.id = ip.profile_id
  WHERE s.id = p_service_id
    AND s.interviewer_profile_id = p_interviewer_profile_id
    AND s.is_active;

  IF v_duration IS NULL THEN
    RETURN;
  END IF;

  v_is_owner := private.owns_interviewer_profile(p_interviewer_profile_id) OR private.is_admin();
  IF NOT v_is_owner AND NOT v_active THEN
    RETURN;
  END IF;

  v_from := COALESCE(p_from, now());
  v_to := LEAST(
    COALESCE(p_to, v_from + interval '28 days'),
    v_from + interval '28 days'
  );
  IF v_to <= v_from THEN
    RETURN;
  END IF;

  RETURN QUERY
  WITH dates AS (
    SELECT d::date AS d
    FROM generate_series(
      (v_from AT TIME ZONE v_tz)::date,
      (v_to AT TIME ZONE v_tz)::date,
      interval '1 day'
    ) AS d
    WHERE (v_range_from IS NULL OR d::date >= v_range_from)
      AND (v_range_until IS NULL OR d::date <= v_range_until)
  ),
  windows AS (
    SELECT
      private.wall_tstz(dates.d, a.start_time, v_tz) AS wstart,
      private.wall_tstz(dates.d, a.end_time, v_tz) AS wend
    FROM dates
    JOIN public.interviewer_availability a
      ON a.interviewer_profile_id = p_interviewer_profile_id
     AND a.weekday = EXTRACT(DOW FROM dates.d)::smallint
    UNION ALL
    SELECT
      private.wall_tstz(c.on_date, c.start_time, v_tz),
      private.wall_tstz(c.on_date, c.end_time, v_tz)
    FROM public.interviewer_custom_slots c
    WHERE c.interviewer_profile_id = p_interviewer_profile_id
      AND c.on_date BETWEEN (v_from AT TIME ZONE v_tz)::date AND (v_to AT TIME ZONE v_tz)::date
      AND (v_range_from IS NULL OR c.on_date >= v_range_from)
      AND (v_range_until IS NULL OR c.on_date <= v_range_until)
  ),
  blocked AS (
    SELECT
      CASE
        WHEN b.all_day OR b.start_time IS NULL
          THEN private.wall_tstz(b.on_date, time '00:00', v_tz)
        ELSE private.wall_tstz(b.on_date, b.start_time, v_tz)
      END AS bstart,
      CASE
        WHEN b.all_day OR b.end_time IS NULL
          THEN private.wall_tstz(b.on_date + 1, time '00:00', v_tz)
        ELSE private.wall_tstz(b.on_date, b.end_time, v_tz)
      END AS bend
    FROM public.interviewer_blocked_times b
    WHERE b.interviewer_profile_id = p_interviewer_profile_id
  ),
  occupied AS (
    SELECT
      bk.starts_at,
      bk.ends_at + make_interval(mins => v_buffer) AS occ_end
    FROM public.bookings bk
    WHERE bk.interviewer_profile_id = p_interviewer_profile_id
      AND bk.status IN (
        'pending_payment'::public.booking_status,
        'requested'::public.booking_status,
        'confirmed'::public.booking_status,
        'in_progress'::public.booking_status
      )
  ),
  raw_slots AS (
    SELECT
      gs AS slot_start,
      gs + make_interval(mins => v_duration) AS slot_end
    FROM windows w
    CROSS JOIN LATERAL generate_series(
      w.wstart,
      w.wend - make_interval(mins => v_duration),
      make_interval(mins => v_duration)
    ) AS gs
  )
  SELECT rs.slot_start, rs.slot_end
  FROM raw_slots rs
  WHERE rs.slot_start >= GREATEST(v_from, now())
    AND rs.slot_end <= v_to
    AND NOT EXISTS (
      SELECT 1 FROM blocked b
      WHERE rs.slot_start < b.bend AND b.bstart < rs.slot_end
    )
    AND NOT EXISTS (
      SELECT 1 FROM occupied o
      WHERE rs.slot_start < o.occ_end AND o.starts_at < rs.slot_end
    )
  ORDER BY rs.slot_start;
END;
$function$;

-- 2. Canonical interviewer skills ----------------------------------------------
-- Reuses the shared canonical skill helpers (the same ones the candidate
-- matching engine uses). Inserting a canonical duplicate for the same
-- interviewer is skipped; renaming onto an existing skill is rejected.

CREATE OR REPLACE FUNCTION private.tg_interviewer_skill_canonical()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_key text;
BEGIN
  v_key := private.canonical_skill_key(NEW.skill);
  IF v_key IS NULL OR v_key = '' THEN
    RAISE EXCEPTION 'invalid_skill' USING ERRCODE = '22023';
  END IF;

  NEW.skill := COALESCE(NULLIF(btrim(private.canonical_skill_label(NEW.skill)), ''), btrim(NEW.skill));

  IF EXISTS (
    SELECT 1
    FROM public.interviewer_skills s
    WHERE s.interviewer_profile_id = NEW.interviewer_profile_id
      AND s.id <> NEW.id
      AND private.canonical_skill_key(s.skill) = v_key
  ) THEN
    IF TG_OP = 'INSERT' THEN
      RETURN NULL;
    END IF;
    RAISE EXCEPTION 'duplicate_skill' USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS interviewer_skills_canonical ON public.interviewer_skills;
CREATE TRIGGER interviewer_skills_canonical
  BEFORE INSERT OR UPDATE OF skill, interviewer_profile_id ON public.interviewer_skills
  FOR EACH ROW EXECUTE FUNCTION private.tg_interviewer_skill_canonical();

REVOKE ALL ON FUNCTION private.tg_custom_slot_within_range() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.tg_interviewer_skill_canonical() FROM PUBLIC, anon, authenticated;

-- 3. Interviewer account deletion ----------------------------------------------
-- Only callable by the service role (the delete-interviewer-account Edge
-- Function, after verifying the caller's JWT). Removes interviewer-owned
-- records, cancels open bookings through cancel_booking, anonymizes records
-- shared with candidates, and reports whether the auth user can be hard
-- deleted or must be soft deleted because shared history still references it.

CREATE OR REPLACE FUNCTION private.delete_interviewer_account(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
DECLARE
  v_role public.user_role;
  v_ip uuid;
  v_booking_id uuid;
  v_cancelled integer := 0;
  v_profile_deleted boolean := false;
  v_hard boolean;
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'profile_required' USING ERRCODE = '22023';
  END IF;

  SELECT role INTO v_role FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found' USING ERRCODE = 'P0002';
  END IF;
  IF v_role <> 'interviewer'::public.user_role THEN
    RAISE EXCEPTION 'not_interviewer' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_ip FROM public.interviewer_profiles WHERE profile_id = p_profile_id FOR UPDATE;

  IF v_ip IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.bookings
      WHERE interviewer_profile_id = v_ip AND status = 'in_progress'::public.booking_status
    ) THEN
      RAISE EXCEPTION 'interview_in_progress' USING ERRCODE = 'P0001';
    END IF;

    -- Cancel open bookings as the interviewer so cancel_booking's ownership
    -- check, payment-hold release and candidate notifications all apply.
    PERFORM set_config('request.jwt.claim.sub', p_profile_id::text, true);
    PERFORM set_config(
      'request.jwt.claims',
      jsonb_build_object('sub', p_profile_id, 'role', 'authenticated')::text,
      true
    );
    FOR v_booking_id IN
      SELECT id FROM public.bookings
      WHERE interviewer_profile_id = v_ip
        AND status IN (
          'pending_payment'::public.booking_status,
          'requested'::public.booking_status,
          'confirmed'::public.booking_status
        )
      ORDER BY starts_at
    LOOP
      PERFORM public.cancel_booking(v_booking_id, 'interviewer_account_deleted');
      v_cancelled := v_cancelled + 1;
    END LOOP;
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claims', '', true);

    DELETE FROM public.interviewer_feedback WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_skills WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_roles WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_availability WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_custom_slots WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_blocked_times WHERE interviewer_profile_id = v_ip;
    DELETE FROM public.interviewer_verifications WHERE interviewer_profile_id = v_ip;

    DELETE FROM public.interviewer_services s
    WHERE s.interviewer_profile_id = v_ip
      AND NOT EXISTS (SELECT 1 FROM public.bookings b WHERE b.service_id = s.id);
    UPDATE public.interviewer_services
    SET is_active = false, description = NULL
    WHERE interviewer_profile_id = v_ip;

    IF NOT EXISTS (SELECT 1 FROM public.bookings WHERE interviewer_profile_id = v_ip)
       AND NOT EXISTS (SELECT 1 FROM public.candidate_reviews WHERE interviewer_profile_id = v_ip) THEN
      DELETE FROM public.interviewer_profiles WHERE id = v_ip;
      v_profile_deleted := true;
    ELSE
      UPDATE public.interviewer_profiles
      SET headline = NULL,
          bio = NULL,
          "current_role" = 'Deleted',
          company = 'Deleted',
          experience_years = 0,
          languages = '{}',
          is_listed = false,
          is_online = false,
          whatsapp_phone = NULL,
          available_from = NULL,
          available_until = NULL
      WHERE id = v_ip;
    END IF;
  ELSE
    v_profile_deleted := true;
  END IF;

  UPDATE public.booking_events SET actor_profile_id = NULL WHERE actor_profile_id = p_profile_id;
  UPDATE public.session_events SET actor_profile_id = NULL WHERE actor_profile_id = p_profile_id;
  UPDATE public.interview_admissions SET decided_by = NULL WHERE decided_by = p_profile_id;

  DELETE FROM public.notifications WHERE profile_id = p_profile_id;
  DELETE FROM public.notification_preferences WHERE profile_id = p_profile_id;

  UPDATE public.profiles
  SET full_name = 'Deleted interviewer',
      avatar_url = NULL,
      is_active = false
  WHERE id = p_profile_id;

  v_hard := v_profile_deleted
    AND NOT EXISTS (SELECT 1 FROM public.audit_logs WHERE admin_profile_id = p_profile_id)
    AND NOT EXISTS (SELECT 1 FROM public.interviewer_verifications WHERE reviewer_admin_id = p_profile_id)
    AND NOT EXISTS (SELECT 1 FROM public.candidate_reviews WHERE moderation_admin_id = p_profile_id);

  RETURN jsonb_build_object(
    'hard_delete', v_hard,
    'cancelled_bookings', v_cancelled
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_interviewer_account_data(p_profile_id uuid)
RETURNS jsonb
LANGUAGE sql
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
  SELECT private.delete_interviewer_account(p_profile_id);
$function$;

REVOKE ALL ON FUNCTION private.delete_interviewer_account(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delete_interviewer_account_data(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.delete_interviewer_account(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.delete_interviewer_account_data(uuid) TO service_role;
