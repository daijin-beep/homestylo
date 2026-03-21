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
  idle: "\u6B63\u5728\u51C6\u5907\u751F\u6210\u6D41\u7A0B...",
  analyzing: "\u6B63\u5728\u5206\u6790\u7A7A\u95F4\u7ED3\u6784...",
  recommending: "\u6B63\u5728\u5339\u914D\u5BB6\u5177\u63A8\u8350...",
  rendering_depth: "\u6B63\u5728\u5206\u6790\u7A7A\u95F4\u6DF1\u5EA6...",
  rendering_flux: "\u6B63\u5728\u751F\u6210\u98CE\u683C\u6548\u679C\u56FE...",
  rendering_hotspot: "\u6B63\u5728\u6807\u6CE8\u5BB6\u5177\u4F4D\u7F6E...",
  finalizing: "\u6B63\u5728\u6574\u7406\u7ED3\u679C\u6570\u636E...",
  done: "\u751F\u6210\u5B8C\u6210\uFF0C\u6B63\u5728\u8DF3\u8F6C\u7ED3\u679C\u9875...",
  timeout:
    "\u6548\u679C\u56FE\u751F\u6210\u65F6\u95F4\u8F83\u957F\uFF0C\u53EF\u4EE5\u5148\u67E5\u770B\u5E03\u5C40\u65B9\u6848\u3002",
  failed: "\u751F\u6210\u6D41\u7A0B\u4E2D\u65AD\uFF0C\u8BF7\u91CD\u8BD5\u3002",
};

const STAGE_LABEL: Record<PipelineStage, string> = {
  idle: "\u51C6\u5907\u4E2D",
  analyzing: "\u7A7A\u95F4\u5206\u6790",
  recommending: "\u63A8\u8350\u8BA1\u7B97",
  rendering_depth: "\u6DF1\u5EA6\u4F30\u8BA1",
  rendering_flux: "\u98CE\u683C\u6E32\u67D3",
  rendering_hotspot: "\u70ED\u70B9\u6807\u6CE8",
  finalizing: "\u7ED3\u679C\u6574\u7406",
  done: "\u5DF2\u5B8C\u6210",
  timeout: "\u751F\u6210\u8D85\u65F6",
  failed: "\u751F\u6210\u5931\u8D25",
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
      throw new Error(payload.error ?? "\u8BF7\u6C42\u5931\u8D25\u3002");
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
    throw new Error(payload.errorMessage ?? "\u8BFB\u53D6\u751F\u6210\u72B6\u6001\u5931\u8D25\u3002");
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
        setErrorMessage("\u7F3A\u5C11 scheme_id\uFF0C\u65E0\u6CD5\u7EE7\u7EED\u3002");
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
            throw new Error(
              statusPayload.errorMessage ?? "\u6548\u679C\u56FE\u751F\u6210\u5931\u8D25\u3002",
            );
          }

          await new Promise((resolve) => window.setTimeout(resolve, 2000));
        }

        if (active) {
          setStage("timeout");
          setErrorMessage(
            "\u6548\u679C\u56FE\u751F\u6210\u65F6\u95F4\u8F83\u957F\uFF0C\u4F60\u53EF\u4EE5\u5148\u67E5\u770B\u5E03\u5C40\u65B9\u6848\u3002",
          );
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setStage("failed");
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "\u751F\u6210\u6D41\u7A0B\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
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
          <motion.div
            className="relative h-20 w-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full border-4 border-[#8B5A37]/25"
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.2, repeat: Number.POSITIVE_INFINITY }}
            />
            <motion.div
              className="absolute inset-2 rounded-full border-4 border-transparent border-t-[#8B5A37]"
              animate={{ rotate: 360 }}
              transition={{
                duration: 1.2,
                repeat: Number.POSITIVE_INFINITY,
                ease: "linear",
              }}
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
            <span>{`\u5F53\u524D\u9636\u6BB5\uFF1A${STAGE_LABEL[stage]}`}</span>
            <span>{`${Math.round(progress)}%`}</span>
          </div>
        </div>

        {isDone ? (
          <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-6">
            <p className="text-base font-medium text-emerald-700">
              {"\u6548\u679C\u56FE\u5DF2\u5B8C\u6210\uFF0C\u6B63\u5728\u6253\u5F00\u7ED3\u679C\u9875\u3002"}
            </p>
            <Link
              href={schemeId ? `/result/${schemeId}` : "/"}
              className="inline-flex h-11 min-w-[200px] items-center justify-center rounded-xl bg-[#8B5A37] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
            >
              {"\u7ACB\u5373\u67E5\u770B\u7ED3\u679C"}
            </Link>
          </div>
        ) : null}

        {isFailed || isTimeout ? (
          <div className="space-y-4 rounded-2xl border border-red-200 bg-red-50 px-6 py-6">
            <p className="text-sm text-red-600">
              {errorMessage ?? "\u6D41\u7A0B\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5\u3002"}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setRunToken((current) => current + 1)}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
              >
                {"\u91CD\u65B0\u5C1D\u8BD5"}
              </button>
              {schemeId ? (
                <Link
                  href={`/result/${schemeId}`}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  {"\u67E5\u770B\u5E03\u5C40\u65B9\u6848"}
                </Link>
              ) : null}
              <Link
                href="/"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
              >
                {"\u8FD4\u56DE\u9996\u9875"}
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
          {"\u6B63\u5728\u51C6\u5907\u52A0\u8F7D\u6D41\u7A0B..."}
        </main>
      }
    >
      <GenerateLoadingPageContent />
    </Suspense>
  );
}
