"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  Camera,
  CheckCircle2,
  FileImage,
  LoaderCircle,
  RefreshCcw,
  UploadCloud,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn, formatDimension } from "@/lib/utils";
import type { SpatialAnalysis } from "@/lib/types";

interface RoomPhotoUploaderProps {
  roomId: string;
  existingPhotoUrl?: string | null;
  existingFloorPlanUrl?: string | null;
  existingSpatialAnalysis?: SpatialAnalysis | null;
  onAnalysisComplete?: (analysis: SpatialAnalysis) => void;
}

type UploadKind = "photo" | "floor_plan";

const FLOOR_MATERIAL_LABELS: Record<string, string> = {
  hardwood: "木地板",
  tile: "瓷砖",
  carpet: "地毯",
  concrete: "混凝土",
  laminate: "复合地板",
  other: "其他",
};

export function RoomPhotoUploader({
  roomId,
  existingPhotoUrl = null,
  existingFloorPlanUrl = null,
  existingSpatialAnalysis = null,
  onAnalysisComplete,
}: RoomPhotoUploaderProps) {
  const [photoUrl, setPhotoUrl] = useState(existingPhotoUrl);
  const [floorPlanUrl, setFloorPlanUrl] = useState(existingFloorPlanUrl);
  const [analysis, setAnalysis] = useState<SpatialAnalysis | null>(existingSpatialAnalysis);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingFloorPlan, setIsUploadingFloorPlan] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisPartial, setAnalysisPartial] = useState(false);
  const [analysisConfirmed, setAnalysisConfirmed] = useState(false);

  useEffect(() => {
    setPhotoUrl(existingPhotoUrl);
  }, [existingPhotoUrl]);

  useEffect(() => {
    setFloorPlanUrl(existingFloorPlanUrl);
  }, [existingFloorPlanUrl]);

  useEffect(() => {
    setAnalysis(existingSpatialAnalysis);
    setAnalysisConfirmed(false);
  }, [existingSpatialAnalysis]);

  const analysisSummary = useMemo(() => {
    if (!analysis) {
      return [];
    }

    const widestWall = analysis.walls.reduce<number | null>((widest, wall) => {
      if (widest === null || wall.estimated_width_mm > widest) {
        return wall.estimated_width_mm;
      }

      return widest;
    }, null);

    return [
      widestWall ? `墙面宽度：约 ${formatDimension(widestWall)}` : null,
      analysis.floor_material
        ? `地板材质：${FLOOR_MATERIAL_LABELS[analysis.floor_material] ?? analysis.floor_material}`
        : null,
      analysis.wall_color ? `墙面颜色：${analysis.wall_color}` : null,
      analysis.lighting_direction ? `光线方向：${analysis.lighting_direction}` : null,
    ].filter((item): item is string => Boolean(item));
  }, [analysis]);

  async function uploadFile(file: File, kind: UploadKind) {
    const setUploading = kind === "photo" ? setIsUploadingPhoto : setIsUploadingFloorPlan;
    setUploading(true);

    if (kind === "photo") {
      setAnalysisConfirmed(false);
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", kind);

      const response = await fetch(`/api/room/${roomId}/upload`, {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: {
          imageUrl: string;
          uploadType: UploadKind;
          room: {
            original_photo_url: string | null;
            current_photo_url: string | null;
            floor_plan_url: string | null;
          };
        };
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "上传失败");
      }

      if (kind === "photo") {
        setPhotoUrl(payload.data.room.current_photo_url || payload.data.room.original_photo_url);
        toast.success("房间照片已上传，开始分析空间");
      } else {
        setFloorPlanUrl(payload.data.room.floor_plan_url);
        toast.success("户型图已上传，将用来提高分析精度");
      }

      await runAnalysis();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
  }

  async function runAnalysis() {
    setIsAnalyzing(true);

    try {
      const response = await fetch(`/api/room/${roomId}/analyze`, {
        method: "POST",
      });
      const payload = (await response.json()) as {
        success: boolean;
        data?: SpatialAnalysis;
        partial?: boolean;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "空间分析失败");
      }

      setAnalysis(payload.data);
      setAnalysisPartial(Boolean(payload.partial));
      setAnalysisConfirmed(false);
      onAnalysisComplete?.(payload.data);

      if (payload.partial) {
        toast.warning("分析已返回可用默认结果，你可以继续，也可以稍后重试");
      } else {
        toast.success("空间分析完成");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "空间分析失败");
    } finally {
      setIsAnalyzing(false);
    }
  }

  const photoDropzone = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
    },
    multiple: false,
    onDropAccepted(files) {
      const file = files[0];
      if (file) {
        void uploadFile(file, "photo");
      }
    },
    onDropRejected() {
      toast.error("请上传 JPEG、PNG、WebP 或 HEIC 格式图片");
    },
  });

  const floorPlanDropzone = useDropzone({
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/heic": [".heic"],
    },
    multiple: false,
    onDropAccepted(files) {
      const file = files[0];
      if (file) {
        void uploadFile(file, "floor_plan");
      }
    },
    onDropRejected() {
      toast.error("请上传 JPEG、PNG、WebP 或 HEIC 格式图片");
    },
  });

  return (
    <div className="space-y-4">
      <UploadCard
        title="房间照片"
        description="拍照或上传一张房间正视图，AI 会自动分析墙面、光线和可摆放区域。"
        isBusy={isUploadingPhoto}
        imageUrl={photoUrl}
        buttonLabel={photoUrl ? "重新拍摄 / 替换照片" : "拍照或上传房间照片"}
        emptyIcon={<Camera className="h-8 w-8" />}
        dropzone={photoDropzone}
      />

      <UploadCard
        title="户型图（可选）"
        description="上传户型图后，AI 会用标注尺寸去校准房间分析结果。"
        isBusy={isUploadingFloorPlan}
        imageUrl={floorPlanUrl}
        buttonLabel={floorPlanUrl ? "替换户型图" : "上传户型图"}
        emptyIcon={<FileImage className="h-8 w-8" />}
        dropzone={floorPlanDropzone}
      />

      <Card className="border-border bg-card">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">AI 空间分析</p>
              <p className="text-sm text-muted-foreground">
                {isAnalyzing
                  ? "AI 正在分析你的房间..."
                  : analysis
                    ? analysisPartial
                      ? "已返回可继续使用的部分结果"
                      : "分析完成，可以确认并继续创建方案"
                    : "上传房间照片后会自动开始分析"}
              </p>
            </div>
            {analysis ? (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium",
                  analysisPartial
                    ? "bg-amber-100 text-amber-700"
                    : "bg-emerald-100 text-emerald-700",
                )}
              >
                {analysisPartial ? "部分结果" : "已分析"}
              </span>
            ) : null}
          </div>

          {isAnalyzing ? (
            <div className="flex min-h-28 items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-muted/35 px-4 text-sm text-muted-foreground">
              <LoaderCircle className="h-5 w-5 animate-spin" />
              AI 正在分析你的房间...
            </div>
          ) : analysis ? (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/25 p-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {analysisSummary.length > 0 ? (
                  analysisSummary.map((item) => (
                    <div
                      key={item}
                      className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground"
                    >
                      {item}
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground sm:col-span-2">
                    当前是默认分析结果，你可以稍后补传更清晰的照片再重试。
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>可摆放区域 {analysis.available_spaces.length} 个</span>
                <span>已识别现有家具 {analysis.existing_furniture.length} 件</span>
                <span>置信度 {Math.round(analysis.confidence * 100)}%</span>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="h-10"
                  onClick={() => {
                    setAnalysisConfirmed(true);
                    toast.success("分析结果已确认，可以继续创建软装方案");
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {analysisConfirmed ? "已确认" : "确认"}
                </Button>
                <Button
                  variant="outline"
                  className="h-10"
                  disabled={!photoUrl || isAnalyzing}
                  onClick={() => void runAnalysis()}
                >
                  <RefreshCcw className="h-4 w-4" />
                  重新分析
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-6 text-sm text-muted-foreground">
              先上传房间照片，分析完成后这里会显示墙面宽度、材质颜色和光线方向摘要。
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UploadCard({
  title,
  description,
  isBusy,
  imageUrl,
  buttonLabel,
  emptyIcon,
  dropzone,
}: {
  title: string;
  description: string;
  isBusy: boolean;
  imageUrl: string | null;
  buttonLabel: string;
  emptyIcon: React.ReactNode;
  dropzone: ReturnType<typeof useDropzone>;
}) {
  const { getRootProps, getInputProps, isDragActive, open } = dropzone;

  return (
    <Card className="border-border bg-card">
      <CardContent className="space-y-4 p-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div
          {...getRootProps()}
          className={cn(
            "relative min-h-[220px] cursor-pointer overflow-hidden rounded-3xl border-2 border-dashed px-4 py-5 transition-colors",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border bg-muted/20 hover:border-primary/50 hover:bg-primary/5",
          )}
        >
          <input {...getInputProps()} />
          {imageUrl ? (
            <div className="space-y-3">
              <div className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-muted">
                <Image
                  src={imageUrl}
                  alt={title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                className="h-10 w-full"
                onClick={(event) => {
                  event.stopPropagation();
                  open();
                }}
              >
                <RefreshCcw className="h-4 w-4" />
                {buttonLabel}
              </Button>
            </div>
          ) : (
            <div className="flex min-h-[180px] flex-col items-center justify-center gap-4 text-center text-muted-foreground">
              <div className="rounded-full bg-background p-4 text-primary shadow-sm">
                {emptyIcon}
              </div>
              <div className="space-y-1">
                <p className="text-base font-medium text-foreground">{buttonLabel}</p>
                <p className="text-sm text-muted-foreground">点击选择图片，或直接拖拽到这里</p>
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs">
                <UploadCloud className="h-3.5 w-3.5" />
                支持 JPEG / PNG / WebP / HEIC
              </div>
            </div>
          )}

          {isBusy ? (
            <div className="absolute inset-0 flex items-center justify-center bg-background/90 text-sm font-medium text-foreground backdrop-blur-sm">
              <div className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 shadow-sm">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                正在上传...
              </div>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
