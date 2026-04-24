import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  tee_time_id: string;
  action: "sign_up" | "withdraw";
}

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tee_time_id, action } = (await req.json()) as RequestBody;

    if (!tee_time_id || !action) {
      return new Response(JSON.stringify({ error: "tee_time_id and action are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (action === "sign_up") {
      return await handleSignUp(serviceClient, user.id, tee_time_id);
    } else if (action === "withdraw") {
      return await handleWithdraw(serviceClient, user.id, tee_time_id);
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleSignUp(
  client: ReturnType<typeof createClient>,
  userId: string,
  teeTimeId: string
) {
  const { data: teeTime, error: ttError } = await client
    .from("tee_times")
    .select("id, max_players, group_id, created_by, status")
    .eq("id", teeTimeId)
    .single();

  if (ttError || !teeTime) {
    return jsonResponse({ error: "Tee time not found" }, 404);
  }

  if (teeTime.status !== "upcoming") {
    return jsonResponse({ error: "Tee time is not open for signups" }, 400);
  }

  const { data: membership } = await client
    .from("group_members")
    .select("id")
    .eq("group_id", teeTime.group_id)
    .eq("user_id", userId)
    .single();

  if (!membership) {
    return jsonResponse({ error: "You must be a group member to sign up" }, 403);
  }

  const { data: existing } = await client
    .from("tee_time_players")
    .select("id, status")
    .eq("tee_time_id", teeTimeId)
    .eq("user_id", userId)
    .single();

  if (existing && existing.status !== "withdrawn") {
    return jsonResponse({ error: "Already signed up" }, 409);
  }

  const { count: confirmedCount } = await client
    .from("tee_time_players")
    .select("id", { count: "exact", head: true })
    .eq("tee_time_id", teeTimeId)
    .eq("status", "confirmed");

  const isFull = (confirmedCount ?? 0) >= teeTime.max_players;
  const status = isFull ? "waitlisted" : "confirmed";

  if (existing && existing.status === "withdrawn") {
    const { error } = await client
      .from("tee_time_players")
      .update({ status, signed_up_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) return jsonResponse({ error: error.message }, 500);
  } else {
    const { error } = await client
      .from("tee_time_players")
      .insert({ tee_time_id: teeTimeId, user_id: userId, status });

    if (error) return jsonResponse({ error: error.message }, 500);
  }

  await client.from("notifications").insert({
    user_id: teeTime.created_by,
    type: "tee_time_signup",
    title: "New signup",
    body: `A player signed up for your tee time`,
    data: { tee_time_id: teeTimeId },
  });

  return jsonResponse({ status, message: isFull ? "Added to waitlist" : "Confirmed" });
}

async function handleWithdraw(
  client: ReturnType<typeof createClient>,
  userId: string,
  teeTimeId: string
) {
  const { data: player, error: pError } = await client
    .from("tee_time_players")
    .select("id, status")
    .eq("tee_time_id", teeTimeId)
    .eq("user_id", userId)
    .single();

  if (pError || !player || player.status === "withdrawn") {
    return jsonResponse({ error: "Not signed up for this tee time" }, 400);
  }

  const wasConfirmed = player.status === "confirmed";

  const { error: withdrawError } = await client
    .from("tee_time_players")
    .update({ status: "withdrawn" })
    .eq("id", player.id);

  if (withdrawError) return jsonResponse({ error: withdrawError.message }, 500);

  const { data: teeTime } = await client
    .from("tee_times")
    .select("created_by, max_players")
    .eq("id", teeTimeId)
    .single();

  await client.from("notifications").insert({
    user_id: teeTime?.created_by,
    type: "tee_time_withdrawal",
    title: "Player withdrew",
    body: `A player withdrew from your tee time`,
    data: { tee_time_id: teeTimeId },
  });

  if (wasConfirmed) {
    const { data: nextWaitlisted } = await client
      .from("tee_time_players")
      .select("id, user_id")
      .eq("tee_time_id", teeTimeId)
      .eq("status", "waitlisted")
      .order("signed_up_at", { ascending: true })
      .limit(1)
      .single();

    if (nextWaitlisted) {
      await client
        .from("tee_time_players")
        .update({ status: "confirmed" })
        .eq("id", nextWaitlisted.id);

      await client.from("notifications").insert({
        user_id: nextWaitlisted.user_id,
        type: "waitlist_promoted",
        title: "You're in!",
        body: "A spot opened up and you've been promoted from the waitlist",
        data: { tee_time_id: teeTimeId },
      });
    }
  }

  return jsonResponse({ status: "withdrawn", message: "Successfully withdrew" });
}

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
