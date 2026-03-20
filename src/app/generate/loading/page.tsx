"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

const LOADING_MESSAGES = [
  "AI正在理解你的空间...",
  "分析墙面和光线...",
  "匹配你的风格偏好...",
  "挑选最适合的家具...",
  "生成搭配效果图...",
  "即将完成...",
];

const TOTAL_DURATION_MS = 40000;

function getProgressByElapsed(elapsedMs: number) {
  if (elapsedMs <= 5000) {
    return (elapsedMs / 5000) * 30;
  }

  if (elapsedMs <= 25000) {
    return 30 + ((elapsedMs - 5000) / 20000) * 40;
  }

  if (elapsedMs <= 35000) {
    return 70 + ((elapsedMs - 25000) / 10000) * 20;
  }

  if (elapsedMs <= TOTAL_DURATION_MS) {
    return 90 + ((elapsedMs - 35000) / 5000) * 10;
  }

  return 100;
}

export default function GenerateLoadingPage() {
  const [progress, setProgress] = useState(0);
  const [messageIndex, setMessageIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const startedAt = Date.now();

    const timer = window.setInterval(() => {
      const elapsedMs = Date.now() - startedAt;
      const nextProgress = Math.min(100, getProgressByElapsed(elapsedMs));
      setProgress(nextProgress);
      setMessageIndex(Math.floor(elapsedMs / 3000) % LOADING_MESSAGES.length);

      if (nextProgress >= 100) {
        setIsCompleted(true);
        window.clearInterval(timer);
      }
    }, 200);

    return () => window.clearInterval(timer);
  }, []);

  const progressText = useMemo(() => `${Math.round(progress)}%`, [progress]);

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
              transition={{ duration: 1.2, repeat: Number.POSITIVE_INFINITY, ease: "linear" }}
            />
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.p
              key={LOADING_MESSAGES[messageIndex]}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="text-xl font-medium text-[#8B5A37]"
            >
              {LOADING_MESSAGES[messageIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="space-y-3">
          <div className="h-1 w-full overflow-hidden rounded-full bg-[#8B5A37]/20">
            <motion.div
              className="h-full rounded-full bg-[#8B5A37]"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{"通常需要30-45秒"}</span>
            <span>{progressText}</span>
          </div>
        </div>

        {isCompleted ? (
          <div className="space-y-4 rounded-2xl border border-border bg-white/80 px-6 py-6">
            <p className="text-base font-medium text-foreground">
              {"效果图生成功能即将上线，敬请期待。"}
            </p>
            <Link
              href="/"
              className="inline-flex h-11 min-w-[200px] items-center justify-center rounded-xl bg-[#8B5A37] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
            >
              {"返回首页"}
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
