-- Keep profile + interviewer timezones aligned; validate zones Postgres can use for slots.

CREATE OR REPLACE FUNCTION public.is_valid_server_timezone(p_tz text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF p_tz IS NULL OR length(trim(p_tz)) = 0 THEN
    RETURN false;
  END IF;
  PERFORM now() AT TIME ZONE trim(p_tz);
  RETURN true;
EXCEPTION
  WHEN invalid_parameter_value THEN
    RETURN false;
  WHEN OTHERS THEN
    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.is_valid_server_timezone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_valid_server_timezone(text) TO authenticated, service_role;

-- Prefer interviewer_profiles.timezone (used by list_bookable_slots), fall back to profiles.timezone.
UPDATE public.profiles p
SET timezone = ip.timezone
FROM public.interviewer_profiles ip
WHERE ip.profile_id = p.id
  AND trim(COALESCE(ip.timezone, '')) <> ''
  AND p.timezone IS DISTINCT FROM ip.timezone;

UPDATE public.interviewer_profiles ip
SET timezone = p.timezone
FROM public.profiles p
WHERE p.id = ip.profile_id
  AND trim(COALESCE(ip.timezone, '')) = ''
  AND trim(COALESCE(p.timezone, '')) <> '';

-- Public directory: never expose an empty timezone (Candidate app drops those rows).
CREATE OR REPLACE VIEW public.interviewer_public_directory
WITH (security_invoker = false) AS
SELECT
  ip.id AS interviewer_profile_id,
  p.full_name,
  p.avatar_url,
  ip.headline,
  ip.bio,
  ip."current_role",
  ip.company,
  ip.experience_years,
  COALESCE(NULLIF(trim(ip.timezone), ''), NULLIF(trim(p.timezone), ''), 'UTC') AS timezone,
  ip.languages,
  ip.list_price_paise,
  ip.currency,
  ip.is_online,
  (
    SELECT ROUND(AVG(cr.overall_rating)::numeric, 1)
    FROM public.candidate_reviews cr
    WHERE cr.interviewer_profile_id = ip.id
      AND cr.moderation_status = 'approved'::public.moderation_status
  ) AS rating_avg,
  (
    SELECT COUNT(*)::integer
    FROM public.candidate_reviews cr
    WHERE cr.interviewer_profile_id = ip.id
      AND cr.moderation_status = 'approved'::public.moderation_status
  ) AS review_count,
  (
    SELECT COUNT(*)::integer
    FROM public.bookings b
    WHERE b.interviewer_profile_id = ip.id
      AND b.status = 'completed'::public.booking_status
  ) AS completed_interviews_count,
  EXISTS (
    SELECT 1 FROM public.interviewer_verifications v
    WHERE v.interviewer_profile_id = ip.id
      AND v.kind = 'identity'::public.verification_kind
      AND v.status = 'verified'::public.verification_status
  ) AS identity_verified,
  EXISTS (
    SELECT 1 FROM public.interviewer_verifications v
    WHERE v.interviewer_profile_id = ip.id
      AND v.kind = 'employment'::public.verification_kind
      AND v.status = 'verified'::public.verification_status
  ) AS employment_verified,
  EXISTS (
    SELECT 1 FROM public.interviewer_verifications v
    WHERE v.interviewer_profile_id = ip.id
      AND v.kind = 'linkedin'::public.verification_kind
      AND v.status = 'verified'::public.verification_status
  ) AS linkedin_verified,
  ip.is_listed
FROM public.interviewer_profiles ip
JOIN public.profiles p ON p.id = ip.profile_id
WHERE p.is_active
  AND (
    ip.is_listed
    OR (
      auth.uid() IS NOT NULL
      AND private.is_candidate()
      AND EXISTS (
        SELECT 1
        FROM public.interviewer_skills sk_visible
        WHERE sk_visible.interviewer_profile_id = ip.id
      )
    )
  );
