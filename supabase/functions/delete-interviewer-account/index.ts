import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CONFIRMATION = "DELETE";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !anonKey || !authorization.toLowerCase().startsWith("bearer ")) {
    return json(401, { error: "not_authenticated" });
  }
  if (!serviceRoleKey) {
    console.log(JSON.stringify({ event: "delete_account_unconfigured" }));
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
  if (body.confirm !== CONFIRMATION) return json(400, { error: "confirmation_required" });

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(401, { error: "not_authenticated" });
  const userId = userData.user.id;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("delete_interviewer_account_data", { p_profile_id: userId });
  if (error) {
    const message = error.message ?? "";
    console.log(JSON.stringify({ event: "delete_account_data_failed", code: error.code ?? null }));
    if (message.includes("interview_in_progress")) return json(409, { error: "interview_in_progress" });
    if (message.includes("not_interviewer")) return json(403, { error: "not_interviewer" });
    if (message.includes("profile_not_found")) return json(404, { error: "profile_not_found" });
    return json(500, { error: "delete_failed" });
  }

  const result = asRecord(data);
  const hardDelete = result?.hard_delete === true;

  // Shared booking history still references a soft-deleted user, so only a
  // user with no remaining references is removed from auth.users outright.
  const { error: authError } = await admin.auth.admin.deleteUser(userId, !hardDelete);
  if (authError) {
    console.log(JSON.stringify({ event: "delete_account_auth_failed", hard_delete: hardDelete }));
    return json(500, { error: "auth_delete_failed" });
  }

  console.log(JSON.stringify({
    event: "delete_account_ok",
    hard_delete: hardDelete,
    cancelled_bookings: result?.cancelled_bookings ?? 0,
  }));
  return json(200, { deleted: true });
});
