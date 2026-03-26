"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  ProgressiveLoading,
  type ProgressiveStage,
} from "@/components/generate/ProgressiveLoading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface GeneratePageClientProps {
  planId: string;
}

interface StatusPayload {
  success?: boolean;
  status?: string;
  stage?: ProgressiveStage;
  imageUrl?: string | null;
  previewUrl?: string | null;
  currentItem?: string | null;
  currentIndex?: number | null;
  totalItems?: number | null;
  errorMessage?: string | null;
}

export default function GeneratePageClient({ planId }: GeneratePageClientProps) {
  const [stage, setStage] = useState<ProgressiveStage>("analyzing");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<string | undefined>(undefined);
  const [currentIndex, setCurrentIndex] = useState<number | undefined>(undefined);
  const [totalItems, setTotalItems] = useState<number | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!planId || startedRef.current) {
      return;
    }

    startedRef.current = true;
    let active = true;
    let timer: number | null = null;

    async function pollStatus() {
      if (!active) {
        return;
      }

      try {
        const response = await fetch(`/api/generate/status?plan_id=${planId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as StatusPayload;

        if (!response.ok || payload.success === false) {
          return;
        }

        setStage(payload.stage ?? "analyzing");
        setPreviewUrl(payload.previewUrl ?? null);
        setFinalImageUrl(payload.imageUrl ?? null);
        setCurrentItem(payload.currentItem ?? undefined);
        setCurrentIndex(payload.currentIndex ?? undefined);
        setTotalItems(payload.totalItems ?? undefined);

        if (payload.errorMessage) {
          setErrorMessage(payload.errorMessage);
        }

        if (
          payload.status === "failed" ||
          (payload.stage === "done" && payload.imageUrl)
        ) {
          if (timer) {
            window.clearInterval(timer);
          }
          setIsBootstrapping(false);
        }
      } catch {
        // Ignore transient polling errors.
      }
    }

    async function startGeneration() {
      try {
        const response = await fetch("/api/generate/effect-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ plan_id: planId }),
        });
        const payload = (await response.json()) as {
          success?: boolean;
          error?: string;
          reason?: string;
        };

        if (!response.ok || payload.success === false) {
          throw new Error(payload.reason ?? payload.error ?? "创建生成任务失败");
        }

        setIsBootstrapping(false);
        await pollStatus();
        timer = window.setInterval(() => {
          void pollStatus();
        }, 2000);
      } catch (error) {
        const message = error instanceof Error ? error.message : "创建生成任务失败";
        setErrorMessage(message);
        setIsBootstrapping(false);
        toast.error(message);
      }
    }

    void startGeneration();

    return () => {
      active = false;
      if (timer) {
        window.clearInterval(timer);
      }
    };
  }, [planId]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <Button asChild variant="outline">
          <Link href={planId ? `/furnishing/${planId}` : "/dashboard"}>
            <ArrowLeft className="h-4 w-4" />
            返回软装清单
          </Link>
        </Button>
      </div>

      {errorMessage ? (
        <Card className="border-destructive/20 bg-card">
          <CardHeader>
            <CardTitle>生成失败</CardTitle>
            <CardDescription>{errorMessage}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href={planId ? `/furnishing/${planId}` : "/dashboard"}>
                回到方案继续调整
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : finalImageUrl && stage === "done" ? (
        <Card className="overflow-hidden border-border bg-card">
          <CardHeader>
            <CardTitle className="text-2xl font-serif">你的效果图已经准备好了</CardTitle>
            <CardDescription>
              Route F 已经完成空间分析、投影计算和原图内渲染，你可以继续返回清单调整商品。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-border bg-muted/30">
              <Image
                src={finalImageUrl}
                alt="Route F 效果图"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={planId ? `/furnishing/${planId}` : "/dashboard"}>
                  返回软装清单
                </Link>
              </Button>
              <Button asChild variant="outline">
                <a href={finalImageUrl} target="_blank" rel="noreferrer">
                  打开原图
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : isBootstrapping ? (
        <Card className="border-border bg-card">
          <CardContent className="flex min-h-[320px] flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">正在创建渲染任务...</p>
          </CardContent>
        </Card>
      ) : (
        <ProgressiveLoading
          stage={stage}
          currentItem={currentItem}
          currentIndex={currentIndex}
          totalItems={totalItems}
          previewUrl={previewUrl ?? undefined}
        />
      )}
    </main>
  );
}
