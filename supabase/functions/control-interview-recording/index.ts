import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { EgressClient, EncodedFileOutput, EncodedFileType } from "npm:livekit-server-sdk@2.13.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function livekitApiUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (url.startsWith("wss://")) return `https://${url.slice("wss://".length)}`;
  if (url.startsWith("ws://")) return `http://${url.slice("http://".length)}`;
  return url;
}

function egressFile() {
  const filepath = `interviews/${crypto.randomUUID()}.mp4`;
  const bucket = Deno.env.get("LIVEKIT_EGRESS_S3_BUCKET") ?? "";
  const accessKey = Deno.env.get("LIVEKIT_EGRESS_S3_ACCESS_KEY") ?? "";
  const secret = Deno.env.get("LIVEKIT_EGRESS_S3_SECRET") ?? "";
  const region = Deno.env.get("LIVEKIT_EGRESS_S3_REGION") ?? "auto";
  const endpoint = Deno.env.get("LIVEKIT_EGRESS_S3_ENDPOINT") ?? "";
  const configured = Boolean(bucket && accessKey && secret);
  const output = new EncodedFileOutput({
    fileType: EncodedFileType.MP4,
    filepath,
    ...(configured
      ? {
        output: {
          case: "s3" as const,
          value: {
            accessKey,
            secret,
            bucket,
            region,
            endpoint: endpoint || undefined,
            forcePathStyle: Boolean(endpoint),
          },
        },
      }
      : {}),
  });
  return { output, filepath, configured };
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
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const apiUrl = livekitApiUrl(Deno.env.get("LIVEKIT_URL") ?? "");
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

  const sessionId = readUuid(body.interview_session_id ?? body.session_id);
  const action = body.action === "stop" ? "stop" : body.action === "start" ? "start" : null;
  if (!sessionId || !action) return json(400, { error: "invalid_body" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "not_authenticated" });

  const { data, error } = await userClient.rpc("assert_interview_recording_access", {
    p_session_id: sessionId,
  });
  if (error || !data) {
    return json(403, { error: "not_authorized" });
  }

  const access = asRecord(data);
  const roomName = typeof access?.room_name === "string" ? access.room_name : "";
  if (!roomName.startsWith("roundone-interview-")) {
    return json(403, { error: "not_authorized" });
  }

  if (!serviceRoleKey) {
    console.log(JSON.stringify({ event: "interview_recording_unconfigured", reason: "service_role" }));
    return json(503, { error: "unconfigured", status: "unavailable" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: existing } = await admin
    .from("interview_recordings")
    .select("id, status, egress_id, started_at, stopped_at")
    .eq("interview_session_id", sessionId)
    .maybeSingle();
  const current = asRecord(existing);
  const recordingId = typeof current?.id === "string" ? current.id : null;
  const currentStatus = typeof current?.status === "string" ? current.status : "";
  const currentEgressId = typeof current?.egress_id === "string" ? current.egress_id : "";

  const livekitReady = apiUrl.startsWith("http") && Boolean(livekitKey && livekitSecret);
  const file = egressFile();
  if (!livekitReady || !file.configured) {
    console.log(JSON.stringify({ event: "interview_recording_unconfigured", reason: "livekit_or_s3" }));
    return json(503, { error: "unconfigured", status: "unavailable", recording_id: recordingId });
  }

  const egress = new EgressClient(apiUrl, livekitKey, livekitSecret);

  if (action === "start") {
    if (recordingId && currentStatus === "recording") {
      return json(200, {
        recording_id: recordingId,
        status: "recording",
        started_at: current?.started_at ?? null,
        stopped_at: null,
      });
    }
    try {
      const info = await egress.startRoomCompositeEgress(roomName, { file: file.output });
      const egressId = egressIdOf(info);
      const startedAt = new Date().toISOString();
      const row = {
        interview_session_id: sessionId,
        started_by: userData.user.id,
        status: "recording",
        egress_id: egressId,
        storage_path: file.filepath,
        error: null,
        started_at: startedAt,
        stopped_at: null,
      };
      const written = recordingId
        ? await admin.from("interview_recordings").update(row).eq("id", recordingId).select("id").single()
        : await admin.from("interview_recordings").insert(row).select("id").single();
      if (written.error || !written.data) {
        if (egressId) await egress.stopEgress(egressId).catch(() => {});
        return json(502, { error: "recording_persist_failed" });
      }
      console.log(JSON.stringify({ event: "interview_recording_started", room_name: roomName }));
      return json(200, {
        recording_id: written.data.id,
        status: "recording",
        started_at: startedAt,
        stopped_at: null,
      });
    } catch {
      console.log(JSON.stringify({ event: "interview_recording_start_failed" }));
      if (recordingId) {
        await admin.from("interview_recordings").update({
          status: "failed",
          error: "egress_failed",
          stopped_at: new Date().toISOString(),
        }).eq("id", recordingId);
      }
      return json(503, { error: "unconfigured", status: "unavailable" });
    }
  }

  if (currentStatus !== "recording" || !recordingId) {
    return json(409, { error: "recording_not_active" });
  }

  try {
    if (currentEgressId) await egress.stopEgress(currentEgressId);
    const stoppedAt = new Date().toISOString();
    await admin.from("interview_recordings").update({
      status: "stopped",
      stopped_at: stoppedAt,
      error: null,
    }).eq("id", recordingId);
    console.log(JSON.stringify({ event: "interview_recording_stopped", room_name: roomName }));
    return json(200, { recording_id: recordingId, status: "stopped", stopped_at: stoppedAt });
  } catch {
    await admin.from("interview_recordings").update({
      status: "failed",
      error: "stop_failed",
      stopped_at: new Date().toISOString(),
    }).eq("id", recordingId);
    return json(502, { error: "stop_failed" });
  }
});
