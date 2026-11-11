-- PostgREST could not choose between text and verification_status overloads (PGRST203).
-- Keep a single signature aligned with moderate_candidate_review.

DROP FUNCTION IF EXISTS public.moderate_interviewer_verification(uuid, text, text);
DROP FUNCTION IF EXISTS public.moderate_interviewer_verification(uuid, public.verification_status, text);

CREATE OR REPLACE FUNCTION public.moderate_interviewer_verification(
  p_verification_id uuid,
  p_status public.verification_status,
  p_notes text DEFAULT NULL
)
RETURNS public.interviewer_verifications
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private'
AS $$
DECLARE
  v_row public.interviewer_verifications;
BEGIN
  IF NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN (
    'pending'::public.verification_status,
    'verified'::public.verification_status,
    'rejected'::public.verification_status
  ) THEN
    RAISE EXCEPTION 'invalid_status' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.interviewer_verifications
  SET
    status = p_status,
    notes = NULLIF(trim(COALESCE(p_notes, '')), '')
  WHERE id = p_verification_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification_not_found' USING ERRCODE = 'P0002';
  END IF;

  PERFORM private.write_audit_log(
    CASE p_status
      WHEN 'verified'::public.verification_status THEN 'verification_approved'
      WHEN 'rejected'::public.verification_status THEN 'verification_rejected'
      ELSE 'verification_pending'
    END,
    'interviewer_verification',
    v_row.id,
    jsonb_build_object('status', v_row.status, 'kind', v_row.kind)
  );

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_interviewer_verification(uuid, public.verification_status, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_interviewer_verification(uuid, public.verification_status, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
