"use client";

import { cn } from "@/lib/utils";

interface BottomBarProps {
  hasPhoto: boolean;
  hasStyle: boolean;
  isDisabled: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
}

export function BottomBar({
  hasPhoto,
  hasStyle,
  isDisabled,
  isSubmitting,
  onSubmit,
}: BottomBarProps) {
  return (
    <div className="sticky bottom-0 z-40 border-t border-border bg-white/95 px-4 py-3 backdrop-blur md:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1 text-sm">
          <p className={cn(hasPhoto ? "text-[#8B5A37]" : "text-muted-foreground")}>
            {hasPhoto ? "✅ 照片已上传" : "⬜ 未上传照片"}
          </p>
          <p className={cn(hasStyle ? "text-[#8B5A37]" : "text-muted-foreground")}>
            {hasStyle ? "✅ 已选风格" : "⬜ AI自动匹配"}
          </p>
        </div>

        <button
          type="button"
          disabled={isDisabled || isSubmitting}
          onClick={onSubmit}
          className={cn(
            "inline-flex h-[52px] min-w-[220px] items-center justify-center rounded-xl px-6 text-base font-semibold transition-colors",
            isDisabled || isSubmitting
              ? "cursor-not-allowed bg-muted text-muted-foreground"
              : "bg-[#8B5A37] text-white hover:bg-[#754a2f]",
          )}
        >
          {isSubmitting ? "正在上传..." : "生成效果图"}
        </button>
      </div>
    </div>
  );
}
