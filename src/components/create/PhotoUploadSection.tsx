"use client";

import { useState } from "react";
import { Camera, UploadCloud } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PhotoUploadSectionProps {
  title: string;
  description: string;
  preview: string | null;
  onChange: (file: File | null) => void;
  compact?: boolean;
}

const ACCEPTED_IMAGE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function PhotoUploadSection({
  title,
  description,
  preview,
  onChange,
  compact = false,
}: PhotoUploadSectionProps) {
  const [error, setError] = useState<string | null>(null);

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: ACCEPTED_IMAGE_TYPES,
    maxFiles: 1,
    maxSize: MAX_FILE_SIZE,
    noKeyboard: true,
    onDropAccepted: (acceptedFiles) => {
      setError(null);
      onChange(acceptedFiles[0] ?? null);
    },
    onDropRejected: () => {
      setError("仅支持 jpg/png/heic/heif，且单张不超过 10MB。");
    },
  });

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-foreground">{title}</h2>
        <div className="h-1 w-10 rounded-full bg-[#8B5A37]" />
      </div>

      <div
        {...getRootProps()}
        className={cn(
          "relative overflow-hidden rounded-2xl border-2 border-dashed bg-white p-4 transition-colors",
          compact ? "min-h-[180px]" : "min-h-[220px] md:min-h-[260px]",
          isDragActive ? "border-[#8B5A37] bg-[#f7f1ea]" : "border-border",
        )}
      >
        <input {...getInputProps()} />

        {preview ? (
          <div className="relative h-full min-h-[160px] w-full">
            <img
              src={preview}
              alt={title}
              className="h-full w-full rounded-xl object-cover"
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="absolute right-3 top-3"
              onClick={(event) => {
                event.stopPropagation();
                open();
              }}
            >
              {"重新选择"}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            className="flex h-full min-h-[160px] w-full flex-col items-center justify-center gap-3 rounded-xl text-center"
            onClick={open}
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#8B5A37]/12 text-[#8B5A37]">
              {compact ? (
                <UploadCloud className="h-6 w-6" />
              ) : (
                <Camera className="h-6 w-6" />
              )}
            </div>
            <p className="text-sm font-medium text-foreground">{description}</p>
            <p className="text-xs text-muted-foreground">
              {"支持 jpg/png/heic/heif，最大 10MB"}
            </p>
          </button>
        )}
      </div>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
