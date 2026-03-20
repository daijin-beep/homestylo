"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RoomType } from "@/lib/types";
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

function removeFromArrayByIndex<T>(list: T[], index: number) {
  return list.filter((_, listIndex) => listIndex !== index);
}

export default function CreatePage() {
  const router = useRouter();
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

  const handleSubmit = () => {
    if (!canSubmit || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    router.push("/generate/loading");
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
