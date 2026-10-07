import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  S3Upload,
} from "npm:livekit-server-sdk@2.13.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RECORDING_BUCKET = "interview-recordings";

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function livekitHttpUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url;
}

function projectRefFromUrl(supabaseUrl: string) {
  try {
    const host = new URL(supabaseUrl).hostname;
    const ref = host.split(".")[0] ?? "";
    return /^[a-z0-9]{10,}$/i.test(ref) ? ref : "";
  } catch {
    return "";
  }
}

type RecordingStorage = {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secret: string;
  region: string;
  sessionToken?: string;
};

function storageConfig(): RecordingStorage | null {
  const endpoint = Deno.env.get("RECORDING_S3_ENDPOINT") ?? Deno.env.get("LIVEKIT_EGRESS_S3_ENDPOINT") ?? "";
  const bucket = Deno.env.get("RECORDING_S3_BUCKET") ?? Deno.env.get("LIVEKIT_EGRESS_S3_BUCKET") ?? "";
  const accessKey = Deno.env.get("RECORDING_S3_ACCESS_KEY") ?? Deno.env.get("LIVEKIT_EGRESS_S3_ACCESS_KEY") ?? "";
  const secret = Deno.env.get("RECORDING_S3_SECRET_KEY") ?? Deno.env.get("LIVEKIT_EGRESS_S3_SECRET") ?? "";
  const region = Deno.env.get("RECORDING_S3_REGION") ?? Deno.env.get("LIVEKIT_EGRESS_S3_REGION") ?? "ap-northeast-1";
  if (endpoint && bucket && accessKey && secret) {
    return { endpoint, bucket, accessKey, secret, region };
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const ref = projectRefFromUrl(supabaseUrl);
  if (!ref || !anonKey || !serviceKey) return null;
  return {
    endpoint: `https://${ref}.storage.supabase.co/storage/v1/s3`,
    bucket: RECORDING_BUCKET,
    accessKey: ref,
    secret: anonKey,
    region,
    sessionToken: serviceKey,
  };
}

function errorCode(error: { message?: string }) {
  const message = error.message ?? "";
  if (message.includes("not_authenticated")) return "not_authenticated";
  if (message.includes("not_authorized")) return "not_authorized";
  if (message.includes("booking_not_confirmed")) return "booking_not_confirmed";
  if (message.includes("session_expired")) return "session_expired";
  if (message.includes("session_not_found")) return "session_not_found";
  if (message.includes("invalid_payload")) return "invalid_body";
  return "recording_failed";
}

function egressIdOf(info: unknown) {
  const row = asRecord(info);
  if (typeof row?.egressId === "string" && row.egressId) return row.egressId;
  if (typeof row?.egress_id === "string" && row.egress_id) return row.egress_id;
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const livekitUrl = livekitHttpUrl(Deno.env.get("LIVEKIT_URL") ?? "");
  const livekitKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const livekitSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !anonKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "not_authenticated" });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = asRecord(await req.json());
    if (!parsed) throw new Error("invalid_body");
    body = parsed;
  } catch {
    return json(400, { error: "invalid_body" });
  }

  const sessionId = readUuid(body.interview_session_id ?? body.interviewSessionId ?? body.session_id);
  const action = body.action === "start" || body.action === "stop" ? body.action : null;
  if (!sessionId || !action) return json(400, { error: "invalid_body" });

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "not_authenticated" });

  const { data: access, error: accessError } = await supabase.rpc("assert_interview_recording_access", {
    p_session_id: sessionId,
  });
  if (accessError) {
    const code = errorCode(accessError);
    const status = code === "not_authenticated" ? 401 : code === "recording_failed" ? 500 : 403;
    return json(status, { error: code });
  }
  const accessRow = asRecord(access);
  const roomName = typeof accessRow?.room_name === "string" ? accessRow.room_name : "";
  if (!roomName.startsWith("roundone-interview-")) return json(403, { error: "not_authorized" });

  const storage = storageConfig();
  if (!serviceKey || !livekitUrl.startsWith("http") || !livekitKey || !livekitSecret || !storage) {
    console.log(JSON.stringify({ event: "interview_recording_unconfigured" }));
    return json(503, { error: "unconfigured", status: "unavailable" });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing, error: existingError } = await admin
    .from("interview_recordings")
    .select("id, status, egress_id, started_at, stopped_at")
    .eq("interview_session_id", sessionId)
    .maybeSingle();
  if (existingError) return json(500, { error: "recording_failed" });
  const current = asRecord(existing);

  const egress = new EgressClient(livekitUrl, livekitKey, livekitSecret);

  if (action === "start") {
    if (current?.status === "recording" && typeof current.egress_id === "string" && current.egress_id) {
      return json(200, {
        recording_id: current.id ?? null,
        status: "recording",
        started_at: current.started_at ?? null,
        stopped_at: null,
      });
    }
    const filepath = `interviews/${sessionId}/${crypto.randomUUID()}.mp4`;
    try {
      const output = new EncodedFileOutput({
        fileType: EncodedFileType.MP4,
        filepath,
        output: {
          case: "s3",
          value: new S3Upload({
            accessKey: storage.accessKey,
            secret: storage.secret,
            bucket: storage.bucket,
            region: storage.region,
            endpoint: storage.endpoint,
            forcePathStyle: true,
            ...(storage.sessionToken ? { sessionToken: storage.sessionToken } : {}),
          }),
        },
      });
      const info = await egress.startRoomCompositeEgress(roomName, output, { layout: "grid" });
      const egressId = egressIdOf(info);
      const startedAt = new Date().toISOString();
      const { data: written, error: writeError } = await admin.from("interview_recordings").upsert(
        {
          interview_session_id: sessionId,
          started_by: userData.user.id,
          status: "recording",
          egress_id: egressId,
          storage_path: filepath,
          error: null,
          started_at: startedAt,
          stopped_at: null,
        },
        { onConflict: "interview_session_id" },
      ).select("id").single();
      if (writeError || !written) {
        if (egressId) await egress.stopEgress(egressId).catch(() => undefined);
        return json(500, { error: "recording_failed" });
      }
      console.log(JSON.stringify({ event: "interview_recording_started", room_name: roomName }));
      return json(200, { recording_id: written.id, status: "recording", started_at: startedAt, stopped_at: null });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "egress_failed";
      console.log(JSON.stringify({ event: "interview_recording_start_failed", detail: message.slice(0, 200) }));
      await admin.from("interview_recordings").upsert(
        {
          interview_session_id: sessionId,
          started_by: userData.user.id,
          status: "failed",
          egress_id: null,
          error: message.slice(0, 500),
          stopped_at: new Date().toISOString(),
        },
        { onConflict: "interview_session_id" },
      );
      return json(502, { error: "recording_failed" });
    }
  }

  if (current?.status !== "recording" || typeof current.egress_id !== "string" || !current.egress_id) {
    return json(409, { error: "recording_not_active" });
  }
  try {
    await egress.stopEgress(current.egress_id);
  } catch {
    console.log(JSON.stringify({ event: "interview_recording_stop_failed" }));
    return json(502, { error: "stop_failed" });
  }
  const stoppedAt = new Date().toISOString();
  const { error: stopError } = await admin
    .from("interview_recordings")
    .update({ status: "stopped", stopped_at: stoppedAt, error: null })
    .eq("interview_session_id", sessionId);
  if (stopError) return json(500, { error: "recording_failed" });
  console.log(JSON.stringify({ event: "interview_recording_stopped", room_name: roomName }));
  return json(200, { recording_id: current.id ?? null, status: "stopped", stopped_at: stoppedAt });
});
