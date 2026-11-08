-- One login email can use the candidate app and the interviewer app.
-- profiles.role may stay candidate; the interviewer app uses interviewer_profiles.

CREATE OR REPLACE FUNCTION public.claim_interviewer_persona()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO pg_catalog, public, auth
AS $function$
DECLARE
  uid uuid := auth.uid();
  v_role public.user_role;
  v_timezone text;
BEGIN
  IF uid IS NULL THEN
    RETURN false;
  END IF;

  SELECT p.role, p.timezone
  INTO v_role, v_timezone
  FROM public.profiles p
  WHERE p.id = uid;

  IF NOT FOUND OR v_role = 'admin'::public.user_role THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.interviewer_profiles WHERE profile_id = uid
  ) THEN
    RETURN true;
  END IF;

  INSERT INTO public.interviewer_profiles (
    profile_id,
    "current_role",
    company,
    timezone,
    list_price_paise,
    is_listed
  )
  VALUES (
    uid,
    'Pending',
    'Pending',
    COALESCE(NULLIF(btrim(v_timezone), ''), 'Asia/Kolkata'),
    0,
    false
  );

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_interviewer_persona() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_interviewer_persona() TO authenticated, service_role;
