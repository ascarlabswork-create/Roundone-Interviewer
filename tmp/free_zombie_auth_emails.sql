-- One-time: free emails for already-deleted accounts so Create account works again.
WITH zombies AS (
  SELECT u.id
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE COALESCE(p.is_active, false) = false
    AND NOT EXISTS (SELECT 1 FROM public.candidate_profiles c WHERE c.profile_id = u.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.interviewer_profiles ip
      WHERE ip.profile_id = u.id
        AND NOT (ip.current_role IN ('Deleted', 'Pending') AND ip.company IN ('Deleted', 'Pending'))
    )
    AND (u.email IS NULL OR u.email NOT LIKE 'deleted+%@deleted.invalid')
),
deleted_identities AS (
  DELETE FROM auth.identities i
  WHERE i.user_id IN (SELECT id FROM zombies)
  RETURNING i.user_id
),
renamed AS (
  UPDATE auth.users u
  SET
    email = 'deleted+' || replace(u.id::text, '-', '') || '@deleted.invalid',
    email_confirmed_at = coalesce(u.email_confirmed_at, now()),
    phone = NULL,
    encrypted_password = NULL,
    raw_user_meta_data = '{}'::jsonb,
    raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    banned_until = '2099-01-01'::timestamptz
  WHERE u.id IN (SELECT id FROM zombies)
  RETURNING u.id
)
SELECT
  (SELECT count(*) FROM zombies) AS zombies_found,
  (SELECT count(*) FROM deleted_identities) AS identities_removed,
  (SELECT count(*) FROM renamed) AS emails_freed;
