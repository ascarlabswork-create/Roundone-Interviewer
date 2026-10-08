-- Defense-in-depth for the private interview-recordings bucket.
-- LiveKit egress uploads with the service role over S3 (no user JWT).
-- Participants may still need object access if a session-token fallback is used.
-- User downloads go through a signed URL from the recording Edge Function.

DROP POLICY IF EXISTS interview_recordings_objects_participant ON storage.objects;

CREATE POLICY interview_recordings_objects_participant
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'interview-recordings'
  AND (storage.foldername(name))[1] = 'interviews'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND private.interview_participant_role(((storage.foldername(name))[2])::uuid) IS NOT NULL
)
WITH CHECK (
  bucket_id = 'interview-recordings'
  AND (storage.foldername(name))[1] = 'interviews'
  AND (storage.foldername(name))[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND private.interview_participant_role(((storage.foldername(name))[2])::uuid) IS NOT NULL
);
