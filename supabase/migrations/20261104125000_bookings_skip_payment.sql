-- Bookings work without an upfront payment.
--
-- The shared create_booking function inserts new bookings as 'pending_payment'
-- and they only become 'requested' (actionable by the interviewer) once a
-- payment is captured. This gate is removed here: new bookings are promoted to
-- 'requested' on insert, and existing payment-hold bookings are promoted too.
--
-- Shared project: this affects both the candidate and interviewer apps. The
-- candidate app may still show a payment screen until its own flow is updated,
-- but the booking no longer waits on payment to reach the interviewer.

CREATE OR REPLACE FUNCTION private.tg_booking_skip_payment()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF NEW.status = 'pending_payment'::public.booking_status THEN
    NEW.status := 'requested'::public.booking_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS booking_skip_payment ON public.bookings;
CREATE TRIGGER booking_skip_payment
  BEFORE INSERT ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION private.tg_booking_skip_payment();

REVOKE ALL ON FUNCTION private.tg_booking_skip_payment() FROM PUBLIC, anon, authenticated;

-- Promote existing payment-hold bookings so interviewers can act on them now.
UPDATE public.bookings
SET status = 'requested'::public.booking_status,
    updated_at = now()
WHERE status = 'pending_payment'::public.booking_status;
