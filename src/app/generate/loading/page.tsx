"use client";

import Link from "next/link";
import { Suspense, startTransition, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

type PipelineStage =
  | "idle"
  | "analyzing"
  | "recommending"
  | "rendering_depth"
  | "rendering_flux"
  | "rendering_hotspot"
  | "finalizing"
  | "done"
  | "timeout"
  | "failed";

interface GenerateStatusResponse {
  success?: boolean;
  status?: string;
  imageUrl?: string | null;
  errorMessage?: string | null;
}

const STAGE_TARGET_PROGRESS: Record<PipelineStage, number> = {
  idle: 5,
  analyzing: 30,
  recommending: 38,
  rendering_depth: 45,
  rendering_flux: 75,
  rendering_hotspot: 90,
  finalizing: 96,
  done: 100,
  timeout: 100,
  failed: 100,
};

const STAGE_MESSAGE: Record<PipelineStage, string> = {
  idle: "正在准备生成流程...",
  analyzing: "正在分析空间结构...",
  recommending: "正在匹配家具推荐...",
  rendering_depth: "正在分析空间深度...",
  rendering_flux: "正在生成风格效果图...",
  rendering_hotspot: "正在标注家具位置...",
  finalizing: "正在整理结果数据...",
  done: "生成完成，正在跳转结果页...",
  timeout: "效果图生成时间较长，可先查看布局方案。",
  failed: "生成流程中断，请重试。",
};

function mapStatusToStage(status: string | undefined): PipelineStage {
  if (status === "done") {
    return "done";
  }

  if (status === "failed") {
    return "failed";
  }

  if (status === "flux") {
    return "rendering_flux";
  }

  if (status === "hotspot") {
    return "rendering_hotspot";
  }

  if (status === "depth" || status === "pending") {
    return "rendering_depth";
  }

  return "rendering_depth";
}

async function postJson<TBody>(url: string, body: TBody, timeoutMs = 45000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    const payload = (await response.json()) as { success?: boolean; error?: string };
    if (!response.ok || payload.success === false) {
      throw new Error(payload.error ?? "请求失败。");
    }

    return payload;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchGenerationStatus(schemeId: string) {
  const response = await fetch(`/api/generate/status?scheme_id=${schemeId}`, {
    cache: "no-store",
  });
  const payload = (await response.json()) as GenerateStatusResponse;

  if (!response.ok || payload.success === false) {
    throw new Error(payload.errorMessage ?? "读取生成状态失败。");
  }

  return payload;
}

function GenerateLoadingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const schemeId = searchParams.get("scheme_id");

  const [stage, setStage] = useState<PipelineStage>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runToken, setRunToken] = useState(0);

  useEffect(() => {
    const target = STAGE_TARGET_PROGRESS[stage];
    const timer = window.setInterval(() => {
      setProgress((current) => {
        if (current >= target) {
          return current;
        }
        const step = stage === "done" ? 8 : 2;
        return Math.min(target, current + step);
      });
    }, 80);

    return () => window.clearInterval(timer);
  }, [stage]);

  useEffect(() => {
    let active = true;
    let redirectTimer: number | null = null;

    const runPipeline = async () => {
      if (!schemeId) {
        setStage("failed");
        setErrorMessage("缺少 scheme_id，无法继续。");
        return;
      }

      setErrorMessage(null);
      setProgress(5);

      try {
        setStage("analyzing");
        await postJson("/api/room/analyze", { scheme_id: schemeId });
        if (!active) {
          return;
        }

        setStage("recommending");
        await postJson("/api/recommend/furniture", { scheme_id: schemeId });
        if (!active) {
          return;
        }

        setStage("rendering_depth");
        await postJson("/api/generate/effect-image", { scheme_id: schemeId }, 20000);
        if (!active) {
          return;
        }

        const pollStartedAt = Date.now();
        while (active && Date.now() - pollStartedAt < 120000) {
          const statusPayload = await fetchGenerationStatus(schemeId);
          const nextStage = mapStatusToStage(statusPayload.status);
          setStage(nextStage);

          if (statusPayload.status === "done") {
            setStage("finalizing");
            await new Promise((resolve) => window.setTimeout(resolve, 500));
            if (!active) {
              return;
            }

            setStage("done");
            redirectTimer = window.setTimeout(() => {
              startTransition(() => {
                router.replace(`/result/${schemeId}`);
              });
            }, 900);
            return;
          }

          if (statusPayload.status === "failed") {
            throw new Error(statusPayload.errorMessage ?? "效果图生成失败。");
          }

          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }

        if (active) {
          setStage("timeout");
          setErrorMessage("效果图生成时间较长，你可以先查看布局图方案。");
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setStage("failed");
        setErrorMessage(
          error instanceof Error ? error.message : "生成流程失败，请稍后重试。",
        );
      }
    };

    void runPipeline();

    return () => {
      active = false;
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [router, runToken, schemeId]);

  const isDone = stage === "done";
  const isFailed = stage === "failed";
  const isTimeout = stage === "timeout";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F5F0E9] px-4">
      <section className="w-full max-w-xl space-y-8 text-center">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5">
          <motion.div className="relative h-20 w-20" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-[#8B5A37]/25"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY }}
            />
            <motion.div
              className="absolute inset-2 rounded-full border-4 border-transparent border-t-[#8B5A37]"
              animate={{ rotate: 360 }}
              transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.p
              key={stage}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.3 }}
              className="text-xl font-medium text-[#8B5A37]"
            >
              {STAGE_MESSAGE[stage]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="space-y-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#8B5A37]/20">
            <motion.div
              className="h-full rounded-full bg-[#8B5A37]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{`当前阶段：${stage}`}</span>
            <span>{`${Math.round(progress)}%`}</span>
          </div>
        </div>

        {isDone ? (
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-6">
            <p className="text-base font-medium text-emerald-700">效果图已完成，正在打开结果页。</p>
            <Link
              href={schemeId ? `/result/${schemeId}` : "/"}
              className="inline-flex h-11 min-w-[200px] items-center justify-center rounded-xl bg-[#8B5A37] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
            >
              立即查看结果
            </Link>
          </div>
        ) : null}

        {(isFailed || isTimeout) ? (
          <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-6">
            <p className="text-sm text-red-600">
              {errorMessage ?? "流程失败，请稍后再试。"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRunToken((current) => current + 1)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
              >
                重新尝试
              </button>
              {schemeId ? (
                <Link
                  href={`/result/${schemeId}`}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  查看布局方案
                </Link>
              ) : null}
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                返回首页
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}

export default function GenerateLoadingPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F5F0E9] px-4 text-[#8B5A37]">
          正在准备加载流程...
        </main>
      }
    >
      <GenerateLoadingPageContent />
    </Suspense>
  );
}

