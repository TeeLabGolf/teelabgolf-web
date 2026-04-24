import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface StartRoundBody {
  action: "start";
  tee_time_id: string;
  format?: "stroke" | "match" | "2v2";
}

interface CompleteRoundBody {
  action: "complete";
  round_id: string;
}

type RequestBody = StartRoundBody | CompleteRoundBody;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as RequestBody;

    if (!body.action) {
      return jsonResponse({ error: "action is required (start or complete)" }, 400);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (body.action === "start") {
      return await handleStart(serviceClient, user.id, body as StartRoundBody);
    } else if (body.action === "complete") {
      return await handleComplete(serviceClient, user.id, body as CompleteRoundBody);
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

async function handleStart(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: StartRoundBody
) {
  const { tee_time_id, format = "stroke" } = body;

  if (!tee_time_id) {
    return jsonResponse({ error: "tee_time_id is required" }, 400);
  }

  const { data: teeTime, error: ttError } = await client
    .from("tee_times")
    .select("id, status, created_by, group_id")
    .eq("id", tee_time_id)
    .single();

  if (ttError || !teeTime) {
    return jsonResponse({ error: "Tee time not found" }, 404);
  }

  if (teeTime.status !== "upcoming") {
    return jsonResponse({ error: "Tee time must be in 'upcoming' status to start" }, 400);
  }

  const isCreator = teeTime.created_by === userId;
  if (!isCreator) {
    const { data: adminMember } = await client
      .from("group_members")
      .select("id")
      .eq("group_id", teeTime.group_id)
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .single();

    if (!adminMember) {
      return jsonResponse({ error: "Only the creator or group admin can start a round" }, 403);
    }
  }

  const { data: round, error: roundError } = await client
    .from("rounds")
    .insert({
      tee_time_id,
      format,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (roundError) {
    return jsonResponse({ error: roundError.message }, 500);
  }

  const { error: updateError } = await client
    .from("tee_times")
    .update({ status: "in_progress" })
    .eq("id", tee_time_id);

  if (updateError) {
    return jsonResponse({ error: updateError.message }, 500);
  }

  return jsonResponse({ round });
}

async function handleComplete(
  client: ReturnType<typeof createClient>,
  userId: string,
  body: CompleteRoundBody
) {
  const { round_id } = body;

  if (!round_id) {
    return jsonResponse({ error: "round_id is required" }, 400);
  }

  const { data: round, error: roundError } = await client
    .from("rounds")
    .select("id, status, tee_time_id")
    .eq("id", round_id)
    .single();

  if (roundError || !round) {
    return jsonResponse({ error: "Round not found" }, 404);
  }

  if (round.status !== "in_progress") {
    return jsonResponse({ error: "Round is not in progress" }, 400);
  }

  const { data: teeTime } = await client
    .from("tee_times")
    .select("created_by, group_id")
    .eq("id", round.tee_time_id)
    .single();

  if (!teeTime) {
    return jsonResponse({ error: "Tee time not found" }, 404);
  }

  const isCreator = teeTime.created_by === userId;
  if (!isCreator) {
    const { data: adminMember } = await client
      .from("group_members")
      .select("id")
      .eq("group_id", teeTime.group_id)
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .single();

    if (!adminMember) {
      return jsonResponse({ error: "Only the creator or group admin can complete a round" }, 403);
    }
  }

  const { error: updateRoundError } = await client
    .from("rounds")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .eq("id", round_id);

  if (updateRoundError) {
    return jsonResponse({ error: updateRoundError.message }, 500);
  }

  const { count: activeRounds } = await client
    .from("rounds")
    .select("id", { count: "exact", head: true })
    .eq("tee_time_id", round.tee_time_id)
    .eq("status", "in_progress");

  if ((activeRounds ?? 0) === 0) {
    await client
      .from("tee_times")
      .update({ status: "completed" })
      .eq("id", round.tee_time_id);
  }

  return jsonResponse({ message: "Round completed", round_id });
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
