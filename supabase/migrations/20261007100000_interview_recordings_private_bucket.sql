-- Private destination for LiveKit room-composite recordings.
-- Objects are not publicly readable. LiveKit egress writes via server-side S3.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'interview-recordings',
  'interview-recordings',
  false,
  2147483648,
  ARRAY['video/mp4']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- No storage.objects policies are created for this bucket, so clients cannot
-- list or download recordings through the Storage API. Egress writes with
-- server-side credentials.
