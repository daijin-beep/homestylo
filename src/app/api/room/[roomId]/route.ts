import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getOwnedRoom(
  roomId: string,
  userId: string,
  withPlans = false,
) {
  const supabase = await createClient();
  const roomQuery = withPlans
    ? supabase
        .from("rooms")
        .select(
          "*, furnishing_plans(id, name, total_budget, current_total, style_preference, status, created_at, updated_at)",
        )
        .eq("id", roomId)
        .single()
    : supabase.from("rooms").select("*").eq("id", roomId).single();

  const { data: room, error } = await roomQuery;

  if (error || !room) {
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

// GET /api/room/[roomId] - get room with furnishing plans
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const room = await getOwnedRoom(roomId, user.id, true);

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: room });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// PATCH /api/room/[roomId] - update room (photo URLs, spatial analysis, etc.)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ownedRoom = await getOwnedRoom(roomId, user.id);

    if (!ownedRoom) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      "name",
      "room_type",
      "original_photo_url",
      "current_photo_url",
      "floor_plan_url",
      "spatial_analysis",
      "depth_map_url",
      "camera_params",
    ];

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updates[field] = body[field];
      }
    }

    const { data: room, error } = await supabase
      .from("rooms")
      .update(updates)
      .eq("id", roomId)
      .select()
      .single();

    if (error || !room) {
      return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: room });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/room/[roomId]
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const ownedRoom = await getOwnedRoom(roomId, user.id);

    if (!ownedRoom) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    }

    const { error } = await supabase.from("rooms").delete().eq("id", roomId);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
