-- Admin verification moderation (experts.jobround.ai → /admin/verifications).

CREATE OR REPLACE FUNCTION public.moderate_interviewer_verification(
  p_verification_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_kind public.verification_kind;
BEGIN
  IF v_admin IS NULL OR NOT private.is_admin() THEN
    RAISE EXCEPTION 'not_authorized';
  END IF;

  IF p_status NOT IN ('pending', 'verified', 'rejected') THEN
    RAISE EXCEPTION 'invalid_status';
  END IF;

  UPDATE public.interviewer_verifications
  SET
    status = p_status::public.verification_status,
    notes = NULLIF(trim(p_notes), ''),
    reviewed_at = now(),
    reviewer_admin_id = v_admin
  WHERE id = p_verification_id
  RETURNING kind INTO v_kind;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'verification_not_found';
  END IF;

  INSERT INTO public.audit_logs (admin_profile_id, action, entity_type, entity_id, metadata)
  VALUES (
    v_admin,
    CASE p_status
      WHEN 'verified' THEN 'verification_approved'
      WHEN 'rejected' THEN 'verification_rejected'
      ELSE 'verification_pending'
    END,
    'interviewer_verification',
    p_verification_id,
    jsonb_build_object('status', p_status, 'kind', v_kind::text)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.moderate_interviewer_verification(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.moderate_interviewer_verification(uuid, text, text) TO authenticated;

DROP POLICY IF EXISTS interviewer_verifications_admin_select ON public.interviewer_verifications;
CREATE POLICY interviewer_verifications_admin_select ON public.interviewer_verifications
  FOR SELECT
  TO authenticated
  USING (private.is_admin());
