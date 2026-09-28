-- Private WhatsApp recipient for interviewer booking notifications.
--
-- Stored in E.164 format (e.g. +919876543210). NULL until the interviewer adds one.
-- Access is governed by the existing interviewer_profiles RLS policies
-- (owner or admin only for SELECT/UPDATE). The public directory views and
-- booking_candidate_summary list their columns explicitly and do not include it.
-- It must never be copied into notification payloads or notification_deliveries;
-- a server-side delivery worker resolves it via
-- notifications.profile_id -> interviewer_profiles.profile_id -> whatsapp_phone.

alter table public.interviewer_profiles
  add column if not exists whatsapp_phone text;

alter table public.interviewer_profiles
  drop constraint if exists interviewer_profiles_whatsapp_phone_e164;

alter table public.interviewer_profiles
  add constraint interviewer_profiles_whatsapp_phone_e164
  check (whatsapp_phone is null or whatsapp_phone ~ '^\+[1-9][0-9]{7,14}$');
