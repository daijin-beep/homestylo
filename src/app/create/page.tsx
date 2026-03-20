"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomType } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { BottomBar } from "@/components/create/BottomBar";
import { ColorPicker } from "@/components/create/ColorPicker";
import { MoodboardSelector } from "@/components/create/MoodboardSelector";
import {
  PrecisionModeToggle,
  type PrecisionDimensions,
} from "@/components/create/PrecisionModeToggle";
import { PhotoUploadSection } from "@/components/create/PhotoUploadSection";
import { ReferenceUpload } from "@/components/create/ReferenceUpload";
import { RoomTypeSelector } from "@/components/create/RoomTypeSelector";
import { StyleSelector } from "@/components/create/StyleSelector";
import { toast } from "sonner";
import { useSchemeStore } from "@/lib/store/schemeStore";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface CreatePageState {
  roomPhoto: File | null;
  roomPhotoPreview: string | null;
  floorPlanPhoto: File | null;
  floorPlanPreview: string | null;
  roomType: RoomType | null;
  precisionMode: "simple" | "precision";
  dimensions: PrecisionDimensions;
  selectedStyle: string | null;
  selectedMoodboards: string[];
  selectedColors: string[];
  referencePhotos: File[];
  referencePhotoPreviews: string[];
}

interface PersistedCreateState {
  roomType: RoomType | null;
  precisionMode: "simple" | "precision";
  dimensions: PrecisionDimensions;
  selectedStyle: string | null;
  selectedMoodboards: string[];
  selectedColors: string[];
}

const INITIAL_STATE: CreatePageState = {
  roomPhoto: null,
  roomPhotoPreview: null,
  floorPlanPhoto: null,
  floorPlanPreview: null,
  roomType: null,
  precisionMode: "simple",
  dimensions: {
    sofaWallWidth: null,
    roomDepth: null,
    ceilingHeight: null,
  },
  selectedStyle: null,
  selectedMoodboards: [],
  selectedColors: [],
  referencePhotos: [],
  referencePhotoPreviews: [],
};

const CREATE_STATE_STORAGE_KEY = "homestylo_create_state";
const ROOM_PHOTO_BUCKET = "room-photos";

function removeFromArrayByIndex<T>(list: T[], index: number) {
  return list.filter((_, listIndex) => listIndex !== index);
}

function normalizeArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

export default function CreatePage() {
  const router = useRouter();
  const [supabase] = useState(() => getSupabaseBrowserClient());
  const { user } = useAuth();
  const { setScheme, setRoomAnalysis, setStep, setLoading } = useSchemeStore();
  const [state, setState] = useState<CreatePageState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const objectUrlsRef = useRef<string[]>([]);

  const registerObjectUrl = (url: string) => {
    objectUrlsRef.current.push(url);
    return url;
  };

  const revokeObjectUrl = (url: string | null) => {
    if (!url) {
      return;
    }

    URL.revokeObjectURL(url);
    objectUrlsRef.current = objectUrlsRef.current.filter((item) => item !== url);
  };

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const rawValue = window.sessionStorage.getItem(CREATE_STATE_STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    try {
      const parsed = JSON.parse(rawValue) as Partial<PersistedCreateState>;

      setState((current) => ({
        ...current,
        roomType:
          parsed.roomType === "living_room" ||
          parsed.roomType === "bedroom" ||
          parsed.roomType === "dining_room"
            ? parsed.roomType
            : null,
        precisionMode: parsed.precisionMode === "precision" ? "precision" : "simple",
        dimensions: {
          sofaWallWidth:
            typeof parsed.dimensions?.sofaWallWidth === "number"
              ? parsed.dimensions.sofaWallWidth
              : null,
          roomDepth:
            typeof parsed.dimensions?.roomDepth === "number"
              ? parsed.dimensions.roomDepth
              : null,
          ceilingHeight:
            typeof parsed.dimensions?.ceilingHeight === "number"
              ? parsed.dimensions.ceilingHeight
              : null,
        },
        selectedStyle:
          typeof parsed.selectedStyle === "string" ? parsed.selectedStyle : null,
        selectedMoodboards: normalizeArray(parsed.selectedMoodboards).slice(0, 3),
        selectedColors: normalizeArray(parsed.selectedColors).slice(0, 3),
      }));

      toast.success("已恢复上次填写的选项，请重新上传照片。");
    } catch {
      // Ignore invalid persisted state.
    } finally {
      window.sessionStorage.removeItem(CREATE_STATE_STORAGE_KEY);
    }
  }, []);

  const handleRoomPhotoChange = (file: File | null) => {
    setState((current) => {
      revokeObjectUrl(current.roomPhotoPreview);
      return {
        ...current,
        roomPhoto: file,
        roomPhotoPreview: file ? registerObjectUrl(URL.createObjectURL(file)) : null,
      };
    });
  };

  const handleFloorPlanChange = (file: File | null) => {
    setState((current) => {
      revokeObjectUrl(current.floorPlanPreview);
      return {
        ...current,
        floorPlanPhoto: file,
        floorPlanPreview: file ? registerObjectUrl(URL.createObjectURL(file)) : null,
      };
    });
  };

  const handleReferenceFilesAdd = (files: File[]) => {
    setState((current) => {
      const remain = Math.max(0, 3 - current.referencePhotos.length);
      if (remain === 0) {
        return current;
      }

      const nextFiles = files.slice(0, remain);
      const nextPreviews = nextFiles.map((file) =>
        registerObjectUrl(URL.createObjectURL(file)),
      );

      return {
        ...current,
        referencePhotos: [...current.referencePhotos, ...nextFiles],
        referencePhotoPreviews: [...current.referencePhotoPreviews, ...nextPreviews],
      };
    });
  };

  const handleReferenceRemove = (index: number) => {
    setState((current) => {
      const removedPreview = current.referencePhotoPreviews[index] ?? null;
      revokeObjectUrl(removedPreview);

      return {
        ...current,
        referencePhotos: removeFromArrayByIndex(current.referencePhotos, index),
        referencePhotoPreviews: removeFromArrayByIndex(
          current.referencePhotoPreviews,
          index,
        ),
      };
    });
  };

  const handleMoodboardToggle = (id: string) => {
    setState((current) => {
      if (current.selectedMoodboards.includes(id)) {
        return {
          ...current,
          selectedMoodboards: current.selectedMoodboards.filter((item) => item !== id),
        };
      }

      if (current.selectedMoodboards.length >= 3) {
        return current;
      }

      return {
        ...current,
        selectedMoodboards: [...current.selectedMoodboards, id],
      };
    });
  };

  const handleColorToggle = (hex: string) => {
    setState((current) => {
      if (current.selectedColors.includes(hex)) {
        return {
          ...current,
          selectedColors: current.selectedColors.filter((item) => item !== hex),
        };
      }

      if (current.selectedColors.length >= 3) {
        return current;
      }

      return {
        ...current,
        selectedColors: [...current.selectedColors, hex],
      };
    });
  };

  const canSubmit = Boolean(state.roomPhoto && state.roomType);

  const uploadPhoto = async (file: File, path: string) => {
    const { error } = await supabase.storage.from(ROOM_PHOTO_BUCKET).upload(path, file, {
      cacheControl: "3600",
      upsert: false,
      contentType: file.type || "image/jpeg",
    });

    if (error) {
      throw new Error(error.message);
    }

    return path;
  };

  const buildPersistedState = (): PersistedCreateState => ({
    roomType: state.roomType,
    precisionMode: state.precisionMode,
    dimensions: state.dimensions,
    selectedStyle: state.selectedStyle,
    selectedMoodboards: state.selectedMoodboards,
    selectedColors: state.selectedColors,
  });

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setLoading(true);

    try {
      if (!user) {
        window.sessionStorage.setItem(
          CREATE_STATE_STORAGE_KEY,
          JSON.stringify(buildPersistedState()),
        );
        router.push("/login?redirect=/create");
        return;
      }

      const timestamp = Date.now();
      const roomPhotoPath = await uploadPhoto(
        state.roomPhoto as File,
        `${user.id}/${timestamp}.jpg`,
      );

      const floorPlanPath = state.floorPlanPhoto
        ? await uploadPhoto(state.floorPlanPhoto, `${user.id}/${timestamp}_floor.jpg`)
        : null;

      const referencePhotoUrls: string[] = [];
      for (let index = 0; index < state.referencePhotos.length; index += 1) {
        const file = state.referencePhotos[index];
        const path = `${user.id}/references/${timestamp}_${index + 1}.jpg`;
        const uploadedPath = await uploadPhoto(file, path);
        referencePhotoUrls.push(uploadedPath);
      }

      const { data: scheme, error: schemeError } = await supabase
        .from("schemes")
        .insert({
          user_id: user.id,
          room_type: state.roomType,
          style: state.selectedStyle,
          status: "analyzing",
        })
        .select("*")
        .single();

      if (schemeError || !scheme) {
        throw new Error(schemeError?.message ?? "创建方案失败。");
      }

      const userInputConstraints =
        state.precisionMode === "precision" && state.dimensions.sofaWallWidth
          ? {
              sofa_wall_width_mm: state.dimensions.sofaWallWidth,
              room_depth_mm: state.dimensions.roomDepth,
              ceiling_height_mm: state.dimensions.ceilingHeight,
              source: "user_input",
            }
          : null;

      const { data: roomAnalysis, error: roomAnalysisError } = await supabase
        .from("room_analysis")
        .insert({
          scheme_id: scheme.id,
          photo_url: roomPhotoPath,
          floor_plan_url: floorPlanPath,
          constraints_json: userInputConstraints,
        })
        .select("*")
        .single();

      if (roomAnalysisError || !roomAnalysis) {
        throw new Error(roomAnalysisError?.message ?? "创建空间分析记录失败。");
      }

      window.localStorage.setItem(
        `homestylo_aesthetic_${scheme.id}`,
        JSON.stringify({
          style: state.selectedStyle,
          moodboards: state.selectedMoodboards,
          colors: state.selectedColors,
          referencePhotoUrls,
        }),
      );

      setScheme(scheme);
      setRoomAnalysis(roomAnalysis);
      setStep("analyze");

      void fetch("/api/room/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scheme_id: scheme.id }),
      });

      router.push(`/generate/loading?scheme_id=${scheme.id}`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "上传失败，请稍后重试。";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
      setLoading(false);
    }
  };

  return (
    <main className="flex flex-1 flex-col bg-[#F5F0E9] pb-28">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-8">
        <header className="mb-6 space-y-2">
          <h1 className="font-serif text-2xl font-bold text-foreground md:text-3xl">
            {"开始设计你的房间"}
          </h1>
          <p className="text-sm text-muted-foreground md:text-base">
            {"一个页面填写全部信息，AI 将直接生成效果图。"}
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <section className="space-y-6 rounded-2xl border border-border bg-white p-4 md:p-6 lg:col-span-3">
            <PhotoUploadSection
              title="房间照片上传（必填）"
              description="上传你的房间照片"
              preview={state.roomPhotoPreview}
              onChange={handleRoomPhotoChange}
            />

            <PhotoUploadSection
              title="户型图上传（选填）"
              description="上传户型图（选填，提升精度）"
              preview={state.floorPlanPreview}
              onChange={handleFloorPlanChange}
              compact
            />

            <RoomTypeSelector
              value={state.roomType}
              onChange={(roomType) => setState((current) => ({ ...current, roomType }))}
            />

            <PrecisionModeToggle
              mode={state.precisionMode}
              dimensions={state.dimensions}
              onModeChange={(precisionMode) =>
                setState((current) => ({ ...current, precisionMode }))
              }
              onDimensionsChange={(dimensions) =>
                setState((current) => ({ ...current, dimensions }))
              }
            />
          </section>

          <section className="space-y-6 rounded-2xl border border-border bg-[#F5F0E9] p-4 md:p-6 lg:col-span-2">
            <StyleSelector
              value={state.selectedStyle}
              onChange={(selectedStyle) =>
                setState((current) => ({ ...current, selectedStyle }))
              }
            />

            <MoodboardSelector
              selected={state.selectedMoodboards}
              onToggle={handleMoodboardToggle}
            />

            <ColorPicker selected={state.selectedColors} onToggle={handleColorToggle} />

            <ReferenceUpload
              previews={state.referencePhotoPreviews}
              onFilesAdd={handleReferenceFilesAdd}
              onRemove={handleReferenceRemove}
            />
          </section>
        </div>
      </div>

      <BottomBar
        hasPhoto={Boolean(state.roomPhoto)}
        hasStyle={Boolean(state.selectedStyle)}
        isDisabled={!canSubmit}
        isSubmitting={isSubmitting}
        onSubmit={handleSubmit}
      />
    </main>
  );
}
