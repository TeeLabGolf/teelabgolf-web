import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  user_id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
}

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

    const {
      user_id,
      type,
      title,
      body: notifBody,
      data: notifData,
    } = (await req.json()) as RequestBody;

    if (!user_id || !type || !title) {
      return jsonResponse(
        { error: "user_id, type, and title are required" },
        400,
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: targetUser } = await serviceClient
      .from("users")
      .select("id")
      .eq("id", user_id)
      .single();

    if (!targetUser) {
      return jsonResponse({ error: "Target user not found" }, 404);
    }

    const { data: notification, error: insertError } = await serviceClient
      .from("notifications")
      .insert({
        user_id,
        type,
        title,
        body: notifBody ?? null,
        data: notifData ?? {},
      })
      .select()
      .single();

    if (insertError) {
      return jsonResponse({ error: insertError.message }, 500);
    }

    // TODO: Send push notification via expo-notifications (AI-2 mobile integration)
    // When ready, call Expo Push API here:
    // const pushToken = await getUserPushToken(serviceClient, user_id);
    // if (pushToken) await sendExpoPush(pushToken, { title, body: notifBody, data: notifData });

    return jsonResponse({ notification });
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
