import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  round_id: string;
  player_id: string;
  hole_number: number;
  strokes: number;
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
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { round_id, player_id, hole_number, strokes } = (await req.json()) as RequestBody;

    if (!round_id || !player_id || !hole_number || !strokes) {
      return jsonResponse({ error: "round_id, player_id, hole_number, and strokes are required" }, 400);
    }

    if (strokes <= 0) {
      return jsonResponse({ error: "Strokes must be greater than 0" }, 400);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: round, error: roundError } = await serviceClient
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

    const { data: teeTime } = await serviceClient
      .from("tee_times")
      .select("course_id")
      .eq("id", round.tee_time_id)
      .single();

    if (!teeTime) {
      return jsonResponse({ error: "Tee time not found" }, 404);
    }

    const { data: course } = await serviceClient
      .from("courses")
      .select("hole_count")
      .eq("id", teeTime.course_id)
      .single();

    if (!course) {
      return jsonResponse({ error: "Course not found" }, 404);
    }

    if (hole_number < 1 || hole_number > course.hole_count) {
      return jsonResponse({ error: `Hole number must be between 1 and ${course.hole_count}` }, 400);
    }

    const { data: scorerPlayer } = await serviceClient
      .from("tee_time_players")
      .select("id")
      .eq("tee_time_id", round.tee_time_id)
      .eq("user_id", user.id)
      .eq("status", "confirmed")
      .single();

    if (!scorerPlayer) {
      return jsonResponse({ error: "You must be a confirmed participant to submit scores" }, 403);
    }

    const { data: targetPlayer } = await serviceClient
      .from("tee_time_players")
      .select("id")
      .eq("tee_time_id", round.tee_time_id)
      .eq("user_id", player_id)
      .eq("status", "confirmed")
      .single();

    if (!targetPlayer) {
      return jsonResponse({ error: "Target player is not a confirmed participant" }, 400);
    }

    const { data: score, error: upsertError } = await serviceClient
      .from("scores")
      .upsert(
        {
          round_id,
          player_id,
          hole_number,
          strokes,
          scored_by: user.id,
        },
        { onConflict: "round_id,player_id,hole_number" }
      )
      .select()
      .single();

    if (upsertError) {
      return jsonResponse({ error: upsertError.message }, 500);
    }

    return jsonResponse({ score });
  } catch (err) {
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});

function jsonResponse(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
