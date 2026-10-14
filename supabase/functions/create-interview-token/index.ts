import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2.13.3";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_TOKEN_TTL_SECONDS = 60 * 60;
const MIN_TOKEN_TTL_SECONDS = 60;

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

function livekitSocketUrl(value: string) {
  const url = value.trim().replace(/\/+$/, "");
  if (url.startsWith("https://")) return `wss://${url.slice("https://".length)}`;
  if (url.startsWith("http://")) return `ws://${url.slice("http://".length)}`;
  return url;
}

function readUuid(value: unknown) {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

/** Tokens stop being usable for (re)joining at the scheduled end, which is never extended. */
function tokenTtlSeconds(endsAt: unknown) {
  const endsAtMs = typeof endsAt === "string" ? Date.parse(endsAt) : Number.NaN;
  if (Number.isNaN(endsAtMs)) return MAX_TOKEN_TTL_SECONDS;
  const remaining = Math.floor((endsAtMs - Date.now()) / 1000);
  return Math.min(MAX_TOKEN_TTL_SECONDS, Math.max(MIN_TOKEN_TTL_SECONDS, remaining));
}

function deniedCode(message: string) {
  if (message.includes("interview_not_started")) return "INTERVIEW_NOT_STARTED";
  if (message.includes("join_window_closed") || message.includes("join_deadline_passed")) return "JOIN_WINDOW_CLOSED";
  if (message.includes("booking_not_confirmed")) return "booking_not_confirmed";
  if (message.includes("session_expired")) return "session_expired";
  if (message.includes("session_not_found") || message.includes("booking_not_found")) return "session_not_found";
  return "not_authorized";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const livekitUrl = livekitSocketUrl(Deno.env.get("LIVEKIT_URL") ?? "");
  const livekitKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const livekitSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !anonKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "not_authenticated" });
  }
  const socketUrlReady = livekitUrl.startsWith("wss://") || livekitUrl.startsWith("ws://");
  if (!socketUrlReady || !livekitKey || !livekitSecret) {
    console.log(JSON.stringify({ event: "interview_token_unconfigured" }));
    return json(503, { error: "unconfigured" });
  }

  let body: Record<string, unknown>;
  try {
    const parsed = asRecord(await req.json());
    if (!parsed) throw new Error("invalid_body");
    body = parsed;
  } catch {
    return json(400, { error: "invalid_body" });
  }

  const bookingId = readUuid(body.booking_id ?? body.bookingId);
  const sessionId = readUuid(body.interview_session_id ?? body.interviewSessionId ?? body.session_id);
  if (!bookingId && !sessionId) return json(400, { error: "invalid_body" });

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "not_authenticated" });

  // Authorization and timing (start, late-join deadline, scheduled end) are enforced on the database clock.
  const { data, error } = await supabase.rpc("prepare_interview_call", {
    p_booking_id: bookingId,
    p_session_id: sessionId,
  });
  if (error || !data) {
    const message = error?.message ?? "not_authorized";
    const status = message.includes("not_authenticated") ? 401 : 403;
    const code = deniedCode(message);
    console.log(JSON.stringify({ event: "interview_token_denied", code }));
    return json(status, { error: code });
  }

  const access = asRecord(data);
  const roomName = typeof access?.room_name === "string" ? access.room_name : "";
  const identity = typeof access?.participant_identity === "string" ? access.participant_identity : "";
  const role = access?.role === "interviewer" ? "interviewer" : access?.role === "candidate" ? "candidate" : "";
  if (!roomName.startsWith("roundone-interview-") || !identity || !role) {
    return json(403, { error: "not_authorized" });
  }
  if (identity !== `${role}:${userData.user.id}`) {
    return json(403, { error: "not_authorized" });
  }

  const token = new AccessToken(livekitKey, livekitSecret, {
    identity,
    ttl: tokenTtlSeconds(access?.ends_at),
  });
  token.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
    // In-room signals such as raise hand travel as LiveKit data messages.
    canPublishData: true,
  });
  const jwt = await token.toJwt();

  console.log(JSON.stringify({
    event: "interview_token_ok",
    role,
    room_name: roomName,
  }));

  return json(200, {
    livekit_url: livekitUrl,
    token: jwt,
    room_name: roomName,
    participant_identity: identity,
    starts_at: access?.starts_at ?? null,
    join_deadline: access?.join_deadline ?? null,
    ends_at: access?.ends_at ?? null,
  });
});
