-- Custom slots are extra windows. They no longer hide that weekday's repeating hours.

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
BEGIN
  PERFORM private.expire_stale_holds(p_interviewer_profile_id);

  IF p_service_id IS NOT NULL THEN
    SELECT ip.timezone, ip.booking_buffer_min, ip.is_listed, p.is_active, s.duration_min
    INTO v_tz, v_buffer, v_listed, v_active, v_duration
    FROM public.interviewer_services s
    JOIN public.interviewer_profiles ip ON ip.id = s.interviewer_profile_id
    JOIN public.profiles p ON p.id = ip.profile_id
    WHERE s.id = p_service_id
      AND s.interviewer_profile_id = p_interviewer_profile_id
      AND s.is_active;
  END IF;

  IF v_duration IS NULL THEN
    SELECT ip.timezone, ip.booking_buffer_min, ip.is_listed, p.is_active, 45
    INTO v_tz, v_buffer, v_listed, v_active, v_duration
    FROM public.interviewer_profiles ip
    JOIN public.profiles p ON p.id = ip.profile_id
    WHERE ip.id = p_interviewer_profile_id;
  END IF;

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
