import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function recalculatePlanCurrentTotal(
  supabase: ServerSupabaseClient,
  planId: string,
) {
  const { data: items, error: itemsError } = await supabase
    .from("furnishing_plan_items")
    .select("price, status")
    .eq("plan_id", planId)
    .neq("status", "abandoned");

  if (itemsError) {
    throw itemsError;
  }

  const total = (items || []).reduce((sum, item) => sum + (item.price ?? 0), 0);

  const { error: updateError } = await supabase
    .from("furnishing_plans")
    .update({ current_total: total, updated_at: new Date().toISOString() })
    .eq("id", planId);

  if (updateError) {
    throw updateError;
  }

  return total;
}
