import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/furnishing/plan - create a furnishing plan for a room
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { room_id, name, total_budget, style_preference } = body as {
      room_id?: string;
      name?: string;
      total_budget?: number | null;
      style_preference?: string | null;
    };

    if (!room_id) {
      return NextResponse.json({ success: false, error: "room_id is required" }, { status: 400 });
    }

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id, home_id")
      .eq("id", room_id)
      .single();

    if (roomError || !room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    }

    const { data: home, error: homeError } = await supabase
      .from("homes")
      .select("id")
      .eq("id", room.home_id)
      .eq("user_id", user.id)
      .single();

    if (homeError || !home) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    }

    const { data: plan, error } = await supabase
      .from("furnishing_plans")
      .insert({
        room_id,
        name: name || "Plan A",
        total_budget: total_budget ?? null,
        style_preference: style_preference ?? null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
