import { createClient } from "@/lib/supabase/server";

type ServerSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function getOwnedRoomRecord(
  supabase: ServerSupabaseClient,
  userId: string,
  roomId: string,
) {
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
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

  return room;
}
