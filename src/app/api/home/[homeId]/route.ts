import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/home/[homeId] - get home with rooms
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ homeId: string }> },
) {
  try {
    const { homeId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data: home, error } = await supabase
      .from("homes")
      .select("*, rooms(*, furnishing_plans(id, name, total_budget, current_total, status))")
      .eq("id", homeId)
      .eq("user_id", user.id)
      .single();

    if (error || !home) {
      return NextResponse.json({ success: false, error: "Home not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: home });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// PATCH /api/home/[homeId] - update home
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ homeId: string }> },
) {
  try {
    const { homeId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, home_type, status, address } = body as {
      name?: string;
      home_type?: string;
      status?: string;
      address?: string | null;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) {
      updates.name = name;
    }
    if (home_type !== undefined) {
      updates.home_type = home_type;
    }
    if (status !== undefined) {
      updates.status = status;
    }
    if (address !== undefined) {
      updates.address = address;
    }

    const { data: home, error } = await supabase
      .from("homes")
      .update(updates)
      .eq("id", homeId)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error || !home) {
      return NextResponse.json({ success: false, error: "Update failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: home });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

// DELETE /api/home/[homeId] - delete home and all rooms/plans
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ homeId: string }> },
) {
  try {
    const { homeId } = await params;
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase.from("homes").delete().eq("id", homeId).eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
