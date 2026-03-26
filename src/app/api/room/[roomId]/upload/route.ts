import { after, NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/api/r2";
import { getOwnedRoomRecord } from "@/lib/room/ownership";
import { runAutoCalibration } from "@/lib/spatial/autoCalibrationPipeline";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

const MAX_FILE_SIZE = 20 * 1024 * 1024;

function getFileExtension(file: File) {
  const mimeExtension = file.type.split("/")[1]?.replace("jpeg", "jpg");

  if (mimeExtension) {
    return mimeExtension;
  }

  const nameExtension = file.name.split(".").pop()?.toLowerCase();
  return nameExtension || "jpg";
}

function scheduleAutoCalibration(task: () => Promise<void>) {
  if (typeof after === "function") {
    after(() => {
      void task();
    });
    return;
  }

  void task();
}

export async function POST(
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

    const room = await getOwnedRoomRecord(supabase, user.id, roomId);

    if (!room) {
      return NextResponse.json({ success: false, error: "Room not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const uploadType = formData.get("type") === "floor_plan" ? "floor_plan" : "photo";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "No file provided" },
        { status: 400 },
      );
    }

    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        {
          success: false,
          error: "Unsupported image format. Use JPEG, PNG, WebP, or HEIC.",
        },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, error: "File too large. Maximum 20MB." },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `room-photos/${roomId}/${uploadType}_${Date.now()}.${getFileExtension(file)}`;
    const imageUrl = await uploadToR2(buffer, key, file.type);

    const updates: Record<string, string> = {
      updated_at: new Date().toISOString(),
    };

    if (uploadType === "floor_plan") {
      updates.floor_plan_url = imageUrl;
    } else {
      updates.original_photo_url = imageUrl;
      updates.current_photo_url = imageUrl;
    }

    const { data: updatedRoom, error: updateError } = await supabase
      .from("rooms")
      .update(updates)
      .eq("id", roomId)
      .select()
      .single();

    if (updateError || !updatedRoom) {
      return NextResponse.json(
        { success: false, error: updateError?.message || "Failed to update room" },
        { status: 500 },
      );
    }

    if (uploadType === "photo") {
      scheduleAutoCalibration(() => runAutoCalibration(roomId, imageUrl));
    }

    return NextResponse.json({
      success: true,
      data: {
        imageUrl,
        uploadType,
        room: updatedRoom,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
