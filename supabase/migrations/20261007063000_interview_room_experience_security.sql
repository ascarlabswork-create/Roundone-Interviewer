-- Reuse shared interview room tables created by the Candidate app
-- (20261006192540_interview_room_chat_notes_recording_feedback).
-- This migration does not recreate those tables or change interview timing.

DO $$
BEGIN
  IF to_regclass('public.interview_messages') IS NULL
     OR to_regclass('public.interview_notes') IS NULL
     OR to_regclass('public.interview_app_feedback') IS NULL
     OR to_regclass('public.interview_recordings') IS NULL THEN
    RAISE EXCEPTION 'shared interview room tables are missing; apply interview_room_chat_notes_recording_feedback first';
  END IF;
END
$$;

ALTER TABLE public.interview_recordings
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS error text;

ALTER TABLE public.interview_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_app_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interview_recordings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.interview_messages FORCE ROW LEVEL SECURITY;
ALTER TABLE public.interview_notes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.interview_app_feedback FORCE ROW LEVEL SECURITY;
ALTER TABLE public.interview_recordings FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.interview_recordings FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.interview_recordings TO authenticated;
GRANT ALL ON public.interview_recordings TO service_role;

CREATE OR REPLACE FUNCTION private.stamp_interview_actor()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'interview_messages' THEN
    NEW.sender_user_id := auth.uid();
  ELSE
    IF TG_OP = 'UPDATE' THEN
      NEW.user_id := OLD.user_id;
    ELSE
      NEW.user_id := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.stamp_interview_actor() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.stamp_interview_actor() TO authenticated, service_role;

DROP TRIGGER IF EXISTS interview_messages_stamp_sender ON public.interview_messages;
CREATE TRIGGER interview_messages_stamp_sender
  BEFORE INSERT ON public.interview_messages
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_interview_actor();

DROP TRIGGER IF EXISTS interview_notes_stamp_owner ON public.interview_notes;
CREATE TRIGGER interview_notes_stamp_owner
  BEFORE INSERT OR UPDATE ON public.interview_notes
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_interview_actor();

DROP TRIGGER IF EXISTS interview_app_feedback_stamp_owner ON public.interview_app_feedback;
CREATE TRIGGER interview_app_feedback_stamp_owner
  BEFORE INSERT OR UPDATE ON public.interview_app_feedback
  FOR EACH ROW
  EXECUTE FUNCTION private.stamp_interview_actor();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'interview_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_messages;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'interview_recordings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.interview_recordings;
  END IF;
END
$$;

GRANT EXECUTE ON FUNCTION public.assert_interview_recording_access(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.assert_interview_recording_access(uuid) FROM PUBLIC, anon;
