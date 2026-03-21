import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";

const PLANS = [
  {
    name: "免费体验",
    price: "¥0",
    features: ["AI 对话", "1 次效果图（水印）", "布局图（低清）", "校验报告"],
    badge: null,
    highlight: false,
  },
  {
    name: "试一试",
    price: "¥9.9",
    features: ["1 个房间", "3 次替换", "无水印导出"],
    badge: null,
    highlight: false,
  },
  {
    name: "认真选",
    price: "¥29.9",
    features: ["1 个房间", "无限替换", "三选一对比", "补配清单", "无水印"],
    badge: "最受欢迎",
    highlight: true,
  },
  {
    name: "全屋搞定",
    price: "¥69.9",
    features: ["2 个房间", "全功能", "记账"],
    badge: "超值",
    highlight: false,
  },
] as const;

const FAQS = [
  {
    question: "免费版和付费版有什么区别？",
    answer:
      "免费版适合先感受流程，能体验 AI 对话、基础布局和 1 次带水印效果图；付费版会开放更多房间次数、替换次数、无水印导出和对比能力。",
  },
  {
    question: "效果图是 AI 生成的吗？准确吗？",
    answer:
      "是 AI 生成，但不是纯灵感图。HomeStylo 会先做尺寸校验、空间分析和布局约束，再生成效果图，所以更适合做下单前决策参考。",
  },
  {
    question: "可以退款吗？",
    answer:
      "如果因为系统故障导致核心功能无法使用，可以联系支持处理。正式退款规则会在付费墙上线时同步完善。",
  },
  {
    question: "支持哪些风格？",
    answer:
      "当前支持中古风、奶油法式、侘寂风、宋式美学和多巴胺风格，后续会继续扩展更多适合国内真实居住场景的方案。",
  },
] as const;

export const metadata: Metadata = {
  title: "套餐价格 | HomeStylo",
  description: "查看 HomeStylo 的定价方案，选择适合你的家居决策套餐。",
};

export default function PricingPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fcf8f2_0%,#f3eadf_100%)]">
      <section className="px-4 pb-8 pt-12 md:px-8 md:pb-10 md:pt-16">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs uppercase tracking-[0.32em] text-[#8B5A37]/70">
              Pricing
            </p>
            <h1 className="font-serif text-4xl font-semibold leading-tight text-foreground md:text-5xl">
              先把大件放进你家，再决定值不值得买
            </h1>
            <p className="text-base leading-7 text-muted-foreground md:text-lg">
              从免费试水到全屋决策，HomeStylo 用同一套 AI 流程帮你做尺寸判断、效果预览和方案比较。
            </p>
          </div>
        </div>
      </section>

      <section className="px-4 pb-10 md:px-8 md:pb-14">
        <div className="mx-auto grid w-full max-w-7xl gap-5 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <article
              key={plan.name}
              className={`relative flex h-full flex-col rounded-[28px] border bg-white p-6 shadow-sm transition-transform duration-200 ${
                plan.highlight
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

              <Link
                href="/create"
                className={`mt-8 inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors ${
                  plan.highlight
                    ? "bg-[#8B5A37] text-white hover:bg-[#754a2f]"
                    : "border border-border bg-[#faf6ef] text-foreground hover:bg-[#f3eadf]"
                }`}
              >
                开始使用
                <ArrowRight className="h-4 w-4" />
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="px-4 pb-16 md:px-8 md:pb-20">
        <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[28px] border border-[#e3d4c3] bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">Why HomeStylo</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-foreground">
              不是只生成好看图，而是帮你做下单判断
            </h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-[#faf6ef] p-4">
                <p className="text-sm font-semibold text-foreground">尺寸校验</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  在下单前先看空间是否真的放得下。
                </p>
              </div>
              <div className="rounded-2xl bg-[#faf6ef] p-4">
                <p className="text-sm font-semibold text-foreground">效果预览</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  把目标商品放进你自己的房间，不再靠脑补。
                </p>
              </div>
              <div className="rounded-2xl bg-[#faf6ef] p-4">
                <p className="text-sm font-semibold text-foreground">方案对比</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  同一空间横向比较，减少犹豫和冲动下单。
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-[#e3d4c3] bg-white p-6 shadow-sm md:p-8">
            <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">FAQ</p>
            <h2 className="mt-3 font-serif text-3xl font-semibold text-foreground">
              常见问题
            </h2>
            <div className="mt-6 space-y-3">
              {FAQS.map((faq) => (
                <details
                  key={faq.question}
                  className="group rounded-2xl border border-border bg-[#fcfaf7] px-4 py-4"
                >
                  <summary className="cursor-pointer list-none pr-6 text-sm font-semibold text-foreground">
                    {faq.question}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {faq.answer}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
