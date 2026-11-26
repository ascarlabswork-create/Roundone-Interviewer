-- Fix "User is banned" after account delete: scrub OAuth identities and lift bans
-- on anonymized deleted auth rows so Google/email can register again.

DELETE FROM auth.identities
WHERE user_id IN (
  SELECT id FROM auth.users WHERE email LIKE 'deleted+%@deleted.invalid'
);

UPDATE auth.users
SET
  banned_until = NULL,
  encrypted_password = NULL,
  raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  raw_user_meta_data = '{}'::jsonb
WHERE email LIKE 'deleted+%@deleted.invalid';

-- Best-effort hard remove when no FKs block it.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM auth.users WHERE email LIKE 'deleted+%@deleted.invalid'
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = r.id;
    EXCEPTION
      WHEN foreign_key_violation THEN
        NULL;
    END;
  END LOOP;
END $$;
