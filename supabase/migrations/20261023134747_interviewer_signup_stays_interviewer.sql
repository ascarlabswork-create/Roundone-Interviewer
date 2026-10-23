-- Interviewer email signup stores persona in user_metadata. GoTrue sometimes
-- drops the reserved `role` key, so the shared handle_new_user trigger was
-- creating a candidate profile. Confirmation then opened the candidate app.
-- Honor interviewer signup markers and copy the result into app_metadata.

CREATE OR REPLACE FUNCTION private.handle_new_user_before()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  requested text;
  meta jsonb;
BEGIN
  meta := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);

  requested := lower(COALESCE(
    NEW.raw_app_meta_data ->> 'role',
    NULLIF(meta ->> 'persona', ''),
    NULLIF(meta ->> 'signup_app', ''),
    NULLIF(meta ->> 'role', ''),
    'candidate'
  ));

  -- Interviewer registration always sends company + current_role.
  -- Candidate registration does not. Use that when `role` was stripped.
  IF requested IS DISTINCT FROM 'interviewer'
     AND COALESCE(meta ->> 'current_role', '') <> ''
     AND COALESCE(meta ->> 'company', '') <> '' THEN
    requested := 'interviewer';
  END IF;

  IF requested NOT IN ('candidate', 'interviewer') THEN
    requested := 'candidate';
  END IF;

  NEW.raw_app_meta_data :=
    COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', requested);
  RETURN NEW;
END;
$$;
