import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { RoomServiceClient } from "npm:livekit-server-sdk@2.13.3";

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
  if (url.startsWith("ws://")) return `http://${url.slice("ws://".length)}`;
  return url;
}

/**
 * Closes the LiveKit room of an interview that has ended (completed, no-show or past its
 * scheduled end), disconnecting anyone still in it. Only a participant of the session may call it.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const apiUrl = livekitApiUrl(Deno.env.get("LIVEKIT_URL") ?? "");
  const livekitKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
  const livekitSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !anonKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "not_authenticated" });
  }
  if (!apiUrl.startsWith("http") || !livekitKey || !livekitSecret) {
    return json(503, { error: "unconfigured" });
  }

  let sessionId: string | null = null;
  try {
    const body = await req.json();
    sessionId = readUuid(body?.interview_session_id ?? body?.session_id);
  } catch {
    sessionId = null;
  }
  if (!sessionId) return json(400, { error: "invalid_body" });

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "not_authenticated" });

  const { data, error } = await supabase.rpc("get_interview_timing", { p_session_id: sessionId });
  if (error || !data || typeof data !== "object") {
    console.log(JSON.stringify({ event: "interview_end_denied" }));
    return json(403, { error: "not_authorized" });
  }
  const phase = (data as Record<string, unknown>).phase;
  if (phase !== "ended" && phase !== "closed") {
    return json(409, { error: "interview_not_ended" });
  }

  const roomName = `roundone-interview-${sessionId}`;
  try {
    await new RoomServiceClient(apiUrl, livekitKey, livekitSecret).deleteRoom(roomName);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message.toLowerCase() : "";
    if (!message.includes("not found") && !message.includes("does not exist")) {
      console.log(JSON.stringify({ event: "interview_end_room_cleanup_failed" }));
      return json(502, { error: "cleanup_failed" });
    }
  }

  console.log(JSON.stringify({ event: "interview_end_ok", room_name: roomName }));
  return json(200, { ended: true });
});
