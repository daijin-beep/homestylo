import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, LayoutGrid, Sparkles, SwatchBook } from "lucide-react";
import { STYLE_DEFINITIONS } from "@/lib/constants";

const STYLE_CONTENT: Array<{
  key: keyof typeof STYLE_DEFINITIONS;
  description: string;
}> = [
  {
    key: "midcentury",
    description: "胡桃木、黄铜和温暖布艺，适合长期住得舒服的客厅。",
  },
  {
    key: "cream_french",
    description: "奶油白和柔和曲线，想要显得更轻盈、更显大时很好用。",
  },
  {
    key: "wabi_sabi",
    description: "朴素、安静、有材质感，适合追求松弛和耐看的家。",
  },
  {
    key: "song",
    description: "克制留白、木色与器物感，更适合偏东方的审美气质。",
  },
  {
    key: "dopamine",
    description: "更鲜明、更有情绪表达，让空间一眼就有记忆点。",
  },
] as const;

const FEATURES = [
  {
    title: "尺寸校验",
    description: "不是只给灵感图，而是先判断这件家具在你家里到底能不能放。",
    icon: LayoutGrid,
  },
  {
    title: "AI 效果图",
    description: "结合你的空间照片与风格偏好，生成更接近真实决策场景的预览。",
    icon: Sparkles,
  },
  {
    title: "三选一对比",
    description: "同一空间横向对比多个方案，不再凭印象和脑补做决定。",
    icon: SwatchBook,
  },
] as const;

export const metadata: Metadata = {
  title: "买大件前，先放进你家看看",
  description: "AI 帮你验证尺寸、预览效果、做出不后悔的选择。",
};

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col bg-[linear-gradient(180deg,#fdf9f3_0%,#f4ecdf_100%)] text-foreground">
      <section className="px-4 pb-10 pt-12 md:px-8 md:pb-14 md:pt-16">
        <div className="mx-auto grid w-full max-w-7xl gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <p className="text-xs uppercase tracking-[0.32em] text-[#8B5A37]/70">
              HomeStylo
            </p>
            <div className="space-y-4">
              <h1 className="max-w-3xl font-serif text-4xl font-semibold leading-tight md:text-6xl">
                买大件前，先放进你家看看
              </h1>
              <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                AI 帮你验证尺寸、预览效果、做出不后悔的选择。不是只看好不好看，而是先看放进你家合不合适。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/create"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#8B5A37] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f]"
              >
                免费试一试
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-border bg-white px-6 text-sm font-medium text-foreground transition-colors hover:bg-muted"
              >
                查看套餐
              </Link>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-[#e2d4c3] bg-white/80 px-4 py-4">
                <p className="text-xl font-semibold text-[#8B5A37]">1 次</p>
                <p className="mt-1 text-sm text-muted-foreground">免费效果图体验</p>
              </div>
              <div className="rounded-2xl border border-[#e2d4c3] bg-white/80 px-4 py-4">
                <p className="text-xl font-semibold text-[#8B5A37]">3 步</p>
                <p className="mt-1 text-sm text-muted-foreground">上传、验证、比较</p>
              </div>
              <div className="rounded-2xl border border-[#e2d4c3] bg-white/80 px-4 py-4">
                <p className="text-xl font-semibold text-[#8B5A37]">更安心</p>
                <p className="mt-1 text-sm text-muted-foreground">减少冲动下单和退换货</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <article className="overflow-hidden rounded-[28px] border border-[#e4d7c6] bg-white shadow-sm">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/images/before.jpg"
                  alt="改造前的房间照片"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  priority
                />
              </div>
              <div className="space-y-1 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Before
                </p>
                <p className="text-base font-semibold text-foreground">真实房间照片</p>
              </div>
            </article>

            <article className="overflow-hidden rounded-[28px] border border-[#e4d7c6] bg-white shadow-sm">
              <div className="relative aspect-[4/5] w-full">
                <Image
                  src="/images/after.jpg"
                  alt="AI 生成的改造后效果图"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 33vw"
                  priority
                />
              </div>
              <div className="space-y-1 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  After
                </p>
                <p className="text-base font-semibold text-foreground">AI 放进你家后的效果</p>
              </div>
            </article>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-8 md:py-12">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.26em] text-[#8B5A37]/70">
                Style Direction
              </p>
              <h2 className="mt-2 font-serif text-3xl font-semibold text-foreground md:text-4xl">
                选一个你喜欢的方向，再开始创建
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-muted-foreground">
              每张卡片都会直接带着预设风格进入创建页，减少第一步的犹豫。
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {STYLE_CONTENT.map((item) => {
              const definition = STYLE_DEFINITIONS[item.key];

              return (
                <Link
                  key={item.key}
                  href={`/create?style=${item.key}`}
                  className="group rounded-[26px] border border-[#e3d4c3] bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-[#cda77c] hover:shadow-lg"
                >
                  <div
                    className="rounded-[22px] p-4"
                    style={{
                      background: `linear-gradient(140deg, ${definition.baseColor} 0%, #ffffff 100%)`,
                    }}
                  >
                    <div className="flex gap-2">
                      <span
                        className="h-10 w-10 rounded-full border border-white/70"
                        style={{ backgroundColor: definition.baseColor }}
                      />
                      <span
                        className="h-10 w-10 rounded-full border border-white/70"
                        style={{ backgroundColor: definition.accentColor }}
                      />
                      <span className="h-10 w-10 rounded-full border border-white/70 bg-[#f7f2ea]" />
                    </div>
                    <p className="mt-6 text-lg font-semibold text-foreground">
                      {definition.label}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-8 md:py-12">
        <div className="mx-auto w-full max-w-7xl space-y-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.26em] text-[#8B5A37]/70">Why It Works</p>
            <h2 className="mt-2 font-serif text-3xl font-semibold text-foreground md:text-4xl">
              不只是好看，更是为了帮你少后悔
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;

              return (
                <article
                  key={feature.title}
                  className="rounded-[28px] border border-[#e2d4c3] bg-white p-6 shadow-sm"
                >
                  <div className="inline-flex rounded-2xl bg-[#f5ebde] p-3 text-[#8B5A37]">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    {feature.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-4 py-10 md:px-8 md:py-12">
        <div className="mx-auto w-full max-w-5xl rounded-[32px] border border-[#e1d1bf] bg-white p-6 shadow-sm md:p-8">
          <p className="text-xs uppercase tracking-[0.26em] text-[#8B5A37]/70">User Voice</p>
          <blockquote className="mt-4 font-serif text-2xl leading-relaxed text-foreground md:text-3xl">
            “加油，造福人类的事业。”
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#f5ebde] text-sm font-semibold text-[#8B5A37]">
              匿名
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">某位真实业主反馈</p>
              <p className="text-sm text-muted-foreground">
                来自实际体验后的留言，已做匿名化处理
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-8 md:px-8 md:pb-24">
        <div className="mx-auto flex w-full max-w-7xl flex-col items-center gap-5 rounded-[32px] border border-[#d9c7b1] bg-[#8B5A37] px-6 py-10 text-center text-white">
          <p className="text-xs uppercase tracking-[0.3em] text-white/70">Ready</p>
          <h2 className="font-serif text-3xl font-semibold md:text-4xl">
            先把想买的大件，放进你家看看
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-white/80 md:text-base">
            免费开始，先试一次真正贴近你家空间的 AI 决策流程。
          </p>
          <Link
            href="/create"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#8B5A37] transition-colors hover:bg-[#f5f0e9]"
          >
            免费开始
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
