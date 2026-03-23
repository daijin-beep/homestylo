import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/room - create a room under a home
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
    const { home_id, name, room_type } = body as {
      home_id?: string;
      name?: string;
      room_type?: string;
    };

    if (!home_id || !name || !room_type) {
      return NextResponse.json(
        { success: false, error: "home_id, name, and room_type are required" },
        { status: 400 },
      );
    }

    const { data: home, error: homeError } = await supabase
      .from("homes")
      .select("id")
      .eq("id", home_id)
      .eq("user_id", user.id)
      .single();

    if (homeError || !home) {
      return NextResponse.json({ success: false, error: "Home not found" }, { status: 404 });
    }

    const { data: room, error } = await supabase
      .from("rooms")
      .insert({ home_id, name, room_type })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: room }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
