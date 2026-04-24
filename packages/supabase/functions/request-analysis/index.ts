import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  type: "round_review" | "trend" | "course-strategy";
  [key: string]: unknown;
}

const VALID_TYPES = ["round_review", "trend", "course-strategy"] as const;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = (await req.json()) as RequestBody;

    if (!body.type || !VALID_TYPES.includes(body.type as typeof VALID_TYPES[number])) {
      return jsonResponse(
        {
          error: `type is required and must be one of: ${VALID_TYPES.join(", ")}`,
        },
        400,
      );
    }

    const agentUrl = Deno.env.get("AGENT_URL");
    if (!agentUrl) {
      return jsonResponse(
        { error: "Analysis service is not configured" },
        503,
      );
    }

    const agentResponse = await fetch(`${agentUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: user.id,
        ...body,
      }),
    });

    if (!agentResponse.ok) {
      const errorText = await agentResponse.text();
      return jsonResponse(
        { error: `Analysis service error: ${errorText}` },
        agentResponse.status,
      );
    }

    const result = await agentResponse.json();
    return jsonResponse({ result });
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
