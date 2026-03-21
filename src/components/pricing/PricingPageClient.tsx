"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Copy } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type VisiblePlanType = "free" | "trial" | "serious" | "full";

interface PlanCard {
  type: VisiblePlanType;
  name: string;
  price: string;
  features: string[];
  badge: string | null;
  highlight: boolean;
}

interface PaymentDialogState {
  orderId: string;
  amount: number;
  note: string;
  alipayQrUrl: string;
  wechatQrUrl: string;
}

const PLANS: PlanCard[] = [
  {
    type: "free",
    name: "免费体验",
    price: "¥0",
    features: ["AI 对话", "1 次效果图（水印）", "布局图（低清）", "校验报告"],
    badge: null,
    highlight: false,
  },
  {
    type: "trial",
    name: "试一试",
    price: "¥9.9",
    features: ["1 个房间", "3 次替换", "无水印导出"],
    badge: null,
    highlight: false,
  },
  {
    type: "serious",
    name: "认真选",
    price: "¥29.9",
    features: ["1 个房间", "无限替换", "三选一对比", "补配清单", "无水印"],
    badge: "最受欢迎",
    highlight: true,
  },
  {
    type: "full",
    name: "全屋搞定",
    price: "¥69.9",
    features: ["2 个房间", "全功能", "记账"],
    badge: "超值",
    highlight: false,
  },
];

const FAQS = [
  {
    question: "免费版和付费版有什么区别？",
    answer:
      "免费版适合先体验流程，付费版会开放更多生成次数、替换次数、无水印导出和对比能力。",
  },
  {
    question: "效果图是 AI 生成的吗？准确吗？",
    answer:
      "是。HomeStylo 会先做尺寸校验与空间分析，再生成效果图，所以更适合做真实下单前的决策参考。",
  },
  {
    question: "可以退款吗？",
    answer: "MVP 阶段如遇核心功能不可用，可联系支持处理，正式退款规则会在支付页继续完善。",
  },
  {
    question: "支持哪些风格？",
    answer: "当前支持中古风、奶油法式、侘寂风、宋式美学和多巴胺风格。",
  },
];

interface PricingPageClientProps {
  initialPlan?: VisiblePlanType;
}

export function PricingPageClient({ initialPlan = "serious" }: PricingPageClientProps) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState<VisiblePlanType>(initialPlan);
  const [loadingPlan, setLoadingPlan] = useState<VisiblePlanType | null>(null);
  const [paymentDialog, setPaymentDialog] = useState<PaymentDialogState | null>(null);

  useEffect(() => {
    setSelectedPlan(initialPlan);
  }, [initialPlan]);

  const selectedPlanCard = useMemo(
    () => PLANS.find((plan) => plan.type === selectedPlan) ?? PLANS[0],
    [selectedPlan],
  );

  const handlePlanAction = async (planType: VisiblePlanType) => {
    setSelectedPlan(planType);

    if (planType === "free") {
      router.push("/create");
      return;
    }

    if (isLoading) {
      return;
    }

    if (!user) {
      router.push(`/login?redirect=${encodeURIComponent(`/pricing?plan=${planType}`)}`);
      return;
    }

    setLoadingPlan(planType);
    try {
      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          plan_type: planType,
          user_id: user.id,
        }),
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        order_id?: string;
        amount?: number;
        payment_note?: string;
        payment?: {
          alipayQrUrl?: string;
          wechatQrUrl?: string;
        };
      };

      if (!response.ok || payload.success === false || !payload.order_id || !payload.amount) {
        throw new Error(payload.error ?? "创建支付订单失败。");
      }

      setPaymentDialog({
        orderId: payload.order_id,
        amount: payload.amount,
        note: payload.payment_note ?? `HS-${payload.order_id}`,
        alipayQrUrl: payload.payment?.alipayQrUrl ?? "/images/payment/alipay-qr.svg",
        wechatQrUrl: payload.payment?.wechatQrUrl ?? "/images/payment/wechat-qr.svg",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建支付订单失败。");
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleCopyNote = async () => {
    if (!paymentDialog) {
      return;
    }

    await navigator.clipboard.writeText(paymentDialog.note);
    toast.success("付款备注已复制。");
  };

  return (
    <>
      <main className="min-h-screen bg-[linear-gradient(180deg,#fcf8f2_0%,#f3eadf_100%)]">
        <section className="px-4 pb-8 pt-12 md:px-8 md:pb-10 md:pt-16">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
            <p className="text-xs uppercase tracking-[0.32em] text-[#8B5A37]/70">Pricing</p>
            <h1 className="max-w-4xl font-serif text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              买大件前，先把它放进你家，再决定值不值得买
            </h1>
            <p className="max-w-3xl text-base leading-7 text-muted-foreground md:text-lg">
              从免费试水到全屋决策，HomeStylo 用同一套 AI 流程帮你做尺寸判断、效果预览和方案比较。
            </p>
          </div>
        </section>

        <section className="px-4 pb-10 md:px-8 md:pb-14">
          <div className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <article
                key={plan.type}
                className={`relative flex h-full flex-col rounded-[28px] border bg-white p-6 shadow-sm transition-transform duration-200 ${
                  plan.highlight || selectedPlan === plan.type
                    ? "border-2 border-[#8B5A37] ring-4 ring-[#8B5A37]/10 lg:-translate-y-2"
                    : "border-[#e5d8c7]"
                }`}
              >
                {plan.badge ? (
                  <div className="absolute right-5 top-5 rounded-full bg-[#8B5A37] px-3 py-1 text-xs font-semibold text-white">
                    {plan.badge}
                  </div>
                ) : null}

                <div className="space-y-3">
                  <p className="text-lg font-semibold text-foreground">{plan.name}</p>
                  <p className="font-serif text-4xl font-semibold text-[#8B5A37]">
                    {plan.price}
                  </p>
                </div>

                <div className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <div key={feature} className="flex items-start gap-3">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#8B5A37]" />
                      <p className="text-sm leading-6 text-muted-foreground">{feature}</p>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => void handlePlanAction(plan.type)}
                  disabled={loadingPlan === plan.type}
                  className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                    plan.highlight
                      ? "bg-[#8B5A37] text-white hover:bg-[#754a2f]"
                      : "border border-border bg-[#faf6ef] text-foreground hover:bg-[#f3eadf]"
                  }`}
                >
                  {loadingPlan === plan.type ? "处理中..." : "开始使用"}
                  <ArrowRight className="h-4 w-4" />
                </button>
              </article>
            ))}
          </div>
        </section>

        <section className="px-4 pb-16 md:px-8 md:pb-20">
          <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-[#e3d4c3] bg-white p-6 shadow-sm md:p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">Why HomeStylo</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-foreground">
                不只是出好看的图，而是帮你做下单判断
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                当前预选套餐：{selectedPlanCard.name}。登录后点击卡片 CTA 即可拉起支付弹窗并生成备注号。
              </p>
            </div>

            <div className="rounded-[28px] border border-[#e3d4c3] bg-white p-6 shadow-sm md:p-8">
              <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">FAQ</p>
              <h2 className="mt-3 font-serif text-3xl font-semibold text-foreground">常见问题</h2>
              <div className="mt-6 space-y-3">
                {FAQS.map((faq) => (
                  <details
                    key={faq.question}
                    className="group rounded-2xl border border-border bg-[#fcfaf7] px-4 py-4"
                  >
                    <summary className="cursor-pointer list-none pr-6 text-sm font-semibold text-foreground">
                      {faq.question}
                    </summary>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">{faq.answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={Boolean(paymentDialog)} onOpenChange={(open) => !open && setPaymentDialog(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>扫码支付并备注订单号</DialogTitle>
            <DialogDescription>
              请使用支付宝或微信扫码，并在转账备注中填写订单号。我们会在 1 小时内人工确认。
            </DialogDescription>
          </DialogHeader>

          {paymentDialog ? (
            <div className="space-y-5">
              <div className="grid gap-4 rounded-2xl border border-[#eadbc9] bg-[#faf6ef] p-4 md:grid-cols-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">金额</p>
                  <p className="mt-2 text-2xl font-semibold text-[#8B5A37]">¥{paymentDialog.amount}</p>
                </div>
                <div className="md:col-span-2">
                  <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">付款备注</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <code className="rounded-lg bg-white px-3 py-2 text-sm text-foreground">
                      {paymentDialog.note}
                    </code>
                    <button
                      type="button"
                      onClick={() => void handleCopyNote()}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-xs font-semibold text-foreground transition-colors hover:bg-muted"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      复制
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {[
                  { label: "支付宝收款码", src: paymentDialog.alipayQrUrl },
                  { label: "微信收款码", src: paymentDialog.wechatQrUrl },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-white p-4 text-center"
                  >
                    <div className="relative mx-auto h-52 w-52 overflow-hidden rounded-2xl border border-border bg-[#f7f4ee]">
                      <Image src={item.src} alt={item.label} fill className="object-contain p-3" />
                    </div>
                    <p className="mt-3 text-sm font-semibold text-foreground">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-white px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              onClick={() => setPaymentDialog(null)}
            >
              稍后支付
            </button>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
              onClick={() => {
                toast.success("我们会在 1 小时内确认，请耐心等待。");
                setPaymentDialog(null);
              }}
            >
              我已完成支付
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
