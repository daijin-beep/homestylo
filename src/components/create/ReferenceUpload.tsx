"use client";

import { useState } from "react";
import Image from "next/image";
import { UploadCloud, X } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReferenceUploadProps {
  previews: string[];
  onFilesAdd: (files: File[]) => void;
  onRemove: (index: number) => void;
}

const ACCEPTED_IMAGE_TYPES = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/heic": [".heic"],
  "image/heif": [".heif"],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_REFERENCE_FILES = 3;

export function ReferenceUpload({
  previews,
  onFilesAdd,
  onRemove,
}: ReferenceUploadProps) {
  const [error, setError] = useState<string | null>(null);
  const remain = Math.max(0, MAX_REFERENCE_FILES - previews.length);

  const { getRootProps, getInputProps, open, isDragActive } = useDropzone({
    accept: ACCEPTED_IMAGE_TYPES,
    maxSize: MAX_FILE_SIZE,
    maxFiles: remain || 1,
    noKeyboard: true,
    onDropAccepted: (acceptedFiles) => {
      if (acceptedFiles.length === 0 || remain <= 0) {
        return;
      }
      setError(null);
      onFilesAdd(acceptedFiles.slice(0, remain));
    },
    onDropRejected: () => {
      setError("仅支持 jpg/png/heic/heif，单张不超过 10MB，最多上传 3 张。");
    },
  });

  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-foreground">{"上传你喜欢的参考图"}</h2>
        <div className="h-1 w-10 rounded-full bg-[#8B5A37]" />
      </div>

      {previews.length < MAX_REFERENCE_FILES ? (
        <div
          {...getRootProps()}
          className={cn(
            "rounded-xl border-2 border-dashed bg-white p-4 transition-colors",
            isDragActive ? "border-[#8B5A37] bg-[#f7f1ea]" : "border-border",
          )}
        >
          <input {...getInputProps()} />
          <button
            type="button"
            onClick={open}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-6 text-sm text-muted-foreground"
          >
            <UploadCloud className="h-4 w-4 text-[#8B5A37]" />
            <span>{`上传参考图（还可上传 ${remain} 张）`}</span>
          </button>
        </div>
      ) : null}

      {previews.length > 0 ? (
        <div className="grid grid-cols-3 gap-3">
          {previews.map((preview, index) => (
            <div
              key={`${preview}-${index}`}
              className="relative h-24 overflow-hidden rounded-xl"
            >
              <Image
                src={preview}
                alt={`reference-${index + 1}`}
                fill
                unoptimized
                sizes="160px"
                className="object-cover"
              />
              <Button
                type="button"
                size="icon"
                variant="secondary"
                className="absolute right-1 top-1 h-6 w-6 rounded-full"
                onClick={() => onRemove(index)}
                aria-label="删除参考图"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {"小红书看到的喜欢的案例？传上来让AI参考。"}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
