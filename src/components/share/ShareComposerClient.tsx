"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Loader2, QrCode, Share2 } from "lucide-react";
import QRCode from "qrcode";
import { toast } from "sonner";
import { ShareRenderCard } from "@/components/share/ShareRenderCard";
import type { ShareRenderData } from "@/lib/share/shareData";
import type { ShareType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ShareComposerClientProps {
  schemeId: string;
  data: ShareRenderData;
}

const SHARE_FORMATS: Array<{
  type: ShareType;
  title: string;
  description: string;
}> = [
  {
    type: "effect_image",
    title: "效果图分享",
    description: "一张效果图，适合直接发给家人朋友征求意见。",
  },
  {
    type: "shopping_list",
    title: "购物清单分享",
    description: "把当前清单和总价打包成一张整洁卡片。",
  },
  {
    type: "compare",
    title: "三选一对比分享",
    description: "横向展示同品类方案差异，适合一起投票。",
  },
];

export function ShareComposerClient({ schemeId, data }: ShareComposerClientProps) {
  const [selectedType, setSelectedType] = useState<ShareType>("effect_image");
  const [isGenerating, setIsGenerating] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!publicUrl) {
      setQrCodeDataUrl(null);
      return;
    }

    let active = true;
    QRCode.toDataURL(publicUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: "#8B5A37",
        light: "#FFFDF9",
      },
    })
      .then((url) => {
        if (active) {
          setQrCodeDataUrl(url);
        }
      })
      .catch(() => {
        if (active) {
          setQrCodeDataUrl(null);
        }
      });

    return () => {
      active = false;
    };
  }, [publicUrl]);

  const selectedFormat = useMemo(
    () => SHARE_FORMATS.find((item) => item.type === selectedType) ?? SHARE_FORMATS[0],
    [selectedType],
  );

  const compareDisabled = selectedType === "compare" && data.compareItems.length === 0;

  const handleGenerate = async () => {
    if (compareDisabled) {
      toast.error("当前还没有可分享的三选一对比内容，先去多换几个方案吧。");
      return;
    }

    setIsGenerating(true);
    setCopied(false);
    try {
      const response = await fetch("/api/share/create", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          scheme_id: schemeId,
          share_type: selectedType,
        }),
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        publicUrl?: string;
      };

      if (!response.ok || payload.success === false || !payload.publicUrl) {
        throw new Error(payload.error ?? "生成分享链接失败。");
      }

      setPublicUrl(payload.publicUrl);
      toast.success("分享链接已生成。");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成分享链接失败。");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!publicUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      toast.success("已复制分享链接。");
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("复制失败，请手动复制链接。");
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <aside className="space-y-5 rounded-[28px] border border-border bg-white p-5 shadow-sm">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">Share</p>
          <h2 className="font-serif text-2xl font-semibold text-foreground">
            生成可公开访问的方案链接
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            选择一种分享格式，系统会生成公开链接和二维码，未登录用户也能直接查看。
          </p>
        </div>

        <div className="space-y-3">
          {SHARE_FORMATS.map((format) => {
            const disabled = format.type === "compare" && data.compareItems.length === 0;

            return (
              <button
                key={format.type}
                type="button"
                onClick={() => setSelectedType(format.type)}
                className={cn(
                  "w-full rounded-2xl border px-4 py-4 text-left transition-all",
                  selectedType === format.type
                    ? "border-[#8B5A37] bg-[#f8f2ea] shadow-sm"
                    : "border-border bg-[#fcfaf7] hover:border-[#cfae88]",
                  disabled && "cursor-not-allowed opacity-55",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-foreground">{format.title}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {format.description}
                    </p>
                  </div>
                  {disabled ? (
                    <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-medium text-amber-700">
                      暂不可用
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={isGenerating}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              生成中
            </>
          ) : (
            <>
              <Share2 className="h-4 w-4" />
              生成分享链接
            </>
          )}
        </button>

        {publicUrl ? (
          <div className="space-y-4 rounded-[24px] border border-[#e4d2bd] bg-[#fbf7f0] p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">分享链接</p>
              <div className="rounded-xl bg-white px-3 py-3 text-sm text-muted-foreground">
                {publicUrl}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? "已复制" : "复制链接"}
              </button>
              <a
                href={publicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                打开公开页
              </a>
            </div>

            <div className="rounded-2xl border border-dashed border-[#d8c4ad] bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <QrCode className="h-4 w-4 text-[#8B5A37]" />
                二维码
              </div>
              {qrCodeDataUrl ? (
                <Image
                  src={qrCodeDataUrl}
                  alt="分享二维码"
                  width={180}
                  height={180}
                  className="rounded-xl"
                  unoptimized
                />
              ) : (
                <div className="flex h-[180px] w-[180px] items-center justify-center rounded-xl bg-[#f7efe4] text-sm text-muted-foreground">
                  生成中
                </div>
              )}
            </div>
          </div>
        ) : null}
      </aside>

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-muted-foreground">当前预览</p>
            <h3 className="mt-1 text-xl font-semibold text-foreground">
              {selectedFormat.title}
            </h3>
          </div>
        </div>

        <ShareRenderCard shareType={selectedType} data={data} />
      </section>
    </div>
  );
}
