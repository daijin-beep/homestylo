"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { CheckCircle2, LoaderCircle, Sparkles } from "lucide-react";

export type ProgressiveStage = "analyzing" | "preparing" | "generating" | "done";

interface ProgressiveLoadingProps {
  stage: ProgressiveStage;
  currentItem?: string;
  currentIndex?: number;
  totalItems?: number;
  previewUrl?: string;
}

const STAGES: ProgressiveStage[] = ["analyzing", "preparing", "generating", "done"];

function getStageIndex(stage: ProgressiveStage) {
  return STAGES.indexOf(stage);
}

function getStageCopy({
  stage,
  currentItem,
  currentIndex,
  totalItems,
}: Omit<ProgressiveLoadingProps, "previewUrl">) {
  switch (stage) {
    case "analyzing":
      return "正在分析你的房间空间...";
    case "preparing":
      return "正在准备家具渲染...";
    case "generating":
      return `AI 正在将${currentItem ?? "家具"}放入你的房间... (${currentIndex ?? 1}/${totalItems ?? 1})`;
    case "done":
      return "完成！";
    default:
      return "正在处理中...";
  }
}

export function ProgressiveLoading({
  stage,
  currentItem,
  currentIndex,
  totalItems,
  previewUrl,
}: ProgressiveLoadingProps) {
  const activeIndex = getStageIndex(stage);
  const copy = getStageCopy({ stage, currentItem, currentIndex, totalItems });

  return (
    <div className="space-y-6 rounded-[28px] border border-border bg-card/95 p-6 shadow-sm">
      <div className="flex items-center gap-3">
        {stage === "done" ? (
          <CheckCircle2 className="h-6 w-6 text-emerald-600" />
        ) : (
          <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
        )}
        <motion.p
          key={`${stage}-${currentItem ?? ""}-${currentIndex ?? 0}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24 }}
          className="text-lg font-medium text-foreground"
        >
          {copy}
        </motion.p>
      </div>

      <div className="overflow-hidden rounded-[24px] border border-border bg-muted/30">
        {stage === "generating" && previewUrl ? (
          <div className="relative aspect-[4/3]">
            <Image
              src={previewUrl}
              alt="生成预览图"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute right-4 top-4 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">
              渲染中
            </div>
          </div>
        ) : (
          <div className="flex aspect-[4/3] flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,_rgba(224,123,60,0.18),_transparent_55%),linear-gradient(135deg,#fbf7f1,#efe4d3)] text-center">
            <Sparkles className="h-10 w-10 text-primary" />
            <p className="max-w-sm px-6 text-sm text-muted-foreground">
              {stage === "done"
                ? "效果图已经生成完成，你可以查看最终结果。"
                : "系统正在依次完成空间分析、投影准备和最终渲染。"}
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-2">
        {STAGES.map((item, index) => {
          const isActive = index === activeIndex;
          const isCompleted = index < activeIndex;

          return (
            <div
              key={item}
              className={`h-2 rounded-full transition-colors ${
                isCompleted
                  ? "bg-emerald-500"
                  : isActive
                    ? "bg-primary"
                    : "bg-muted"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
