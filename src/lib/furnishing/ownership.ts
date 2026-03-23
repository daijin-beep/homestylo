import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function getOwnedPlanRecord(
  supabase: ServerSupabaseClient,
  userId: string,
  planId: string,
) {
  const { data: plan, error: planError } = await supabase
    .from("furnishing_plans")
    .select("*")
    .eq("id", planId)
    .single();

  if (planError || !plan) {
    return null;
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id, home_id")
    .eq("id", plan.room_id)
    .single();

  if (roomError || !room) {
    return null;
  }

  const { data: home, error: homeError } = await supabase
    .from("homes")
    .select("id")
    .eq("id", room.home_id)
    .eq("user_id", userId)
    .single();

  if (homeError || !home) {
    return null;
  }

  return plan;
}

export async function getOwnedItemRecord(
  supabase: ServerSupabaseClient,
  userId: string,
  itemId: string,
) {
  const { data: item, error: itemError } = await supabase
    .from("furnishing_plan_items")
    .select("*")
    .eq("id", itemId)
    .single();

  if (itemError || !item) {
    return null;
  }

  const plan = await getOwnedPlanRecord(supabase, userId, item.plan_id);

  if (!plan) {
    return null;
  }

  return item;
}
