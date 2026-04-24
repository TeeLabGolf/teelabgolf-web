import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  request_id: string;
  approved: boolean;
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

    const { request_id, approved } = (await req.json()) as RequestBody;

    if (!request_id || typeof approved !== "boolean") {
      return jsonResponse(
        { error: "request_id (string) and approved (boolean) are required" },
        400,
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: joinRequest, error: jrError } = await serviceClient
      .from("group_join_requests")
      .select("id, group_id, user_id, status")
      .eq("id", request_id)
      .single();

    if (jrError || !joinRequest) {
      return jsonResponse({ error: "Join request not found" }, 404);
    }

    if (joinRequest.status !== "pending") {
      return jsonResponse({ error: "Request has already been reviewed" }, 409);
    }

    const { data: reviewer } = await serviceClient
      .from("group_members")
      .select("role")
      .eq("group_id", joinRequest.group_id)
      .eq("user_id", user.id)
      .single();

    if (!reviewer || !["owner", "admin"].includes(reviewer.role)) {
      return jsonResponse(
        { error: "Only group owner or admin can review requests" },
        403,
      );
    }

    const now = new Date().toISOString();
    const newStatus = approved ? "approved" : "rejected";

    const { error: updateError } = await serviceClient
      .from("group_join_requests")
      .update({
        status: newStatus,
        reviewed_by: user.id,
        reviewed_at: now,
      })
      .eq("id", request_id);

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 500);
    }

    if (approved) {
      const { error: memberError } = await serviceClient
        .from("group_members")
        .insert({
          group_id: joinRequest.group_id,
          user_id: joinRequest.user_id,
          role: "member",
        });

      if (memberError) {
        return jsonResponse({ error: memberError.message }, 500);
      }
    }

    const { data: group } = await serviceClient
      .from("groups")
      .select("name")
      .eq("id", joinRequest.group_id)
      .single();

    const groupName = group?.name ?? "the group";

    await serviceClient.from("notifications").insert({
      user_id: joinRequest.user_id,
      type: approved ? "join_approved" : "join_rejected",
      title: approved ? "Request approved" : "Request rejected",
      body: approved
        ? `Your request to join ${groupName} has been approved`
        : `Your request to join ${groupName} has been rejected`,
      data: { group_id: joinRequest.group_id },
    });

    return jsonResponse({
      status: newStatus,
      message: approved ? "Request approved" : "Request rejected",
    });
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
