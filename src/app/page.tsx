import Link from "next/link";

export default async function HomePage() {
  return (
    <main className="flex flex-1 flex-col bg-[#F5F0E9] text-foreground">
      <section className="px-4 pb-12 pt-16 md:px-8 md:pb-16 md:pt-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
          <h1 className="max-w-4xl font-serif text-[28px] font-extrabold leading-tight md:text-[36px]">
            {"买大件前，先放进你家看看"}
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
            {"上传房间照片，选择你喜欢的风格，AI 30秒生成搭配效果图"}
          </p>
          <Link
            href="/create"
            className="inline-flex h-[52px] min-w-[240px] items-center justify-center rounded-xl bg-[#8B5A37] px-8 text-base font-semibold text-white transition-colors hover:bg-[#754a2f]"
          >
            {"开始设计我的房间"}
          </Link>
          <p className="text-sm text-muted-foreground">{"免费体验一次，无需注册"}</p>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
          <h2 className="text-center text-2xl font-serif font-semibold text-foreground">
            {"你的房间，也可以变成这样"}
          </h2>
          <div className="grid gap-4 md:grid-cols-2 md:gap-6">
            <div
              className="relative flex min-h-[220px] items-end rounded-2xl border border-border bg-cover bg-center p-4"
              style={{ backgroundImage: "url('/images/before.jpg')" }}
            >
              <div className="rounded-full bg-black/45 px-3 py-1 text-sm text-white">
                {"改造前 · 客厅实拍"}
              </div>
            </div>
            <div
              className="relative flex min-h-[220px] items-end rounded-2xl border border-border bg-cover bg-center p-4"
              style={{ backgroundImage: "url('/images/after.jpg')" }}
            >
              <div className="rounded-full bg-black/45 px-3 py-1 text-sm text-white">
                {"改造后 · AI效果图"}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-8 md:px-8 md:py-10">
        <div className="mx-auto grid w-full max-w-5xl gap-4 md:grid-cols-3 md:gap-6">
          <div className="rounded-2xl border border-border bg-white px-4 py-5 text-center text-sm font-medium">
            {"📷 上传房间照片"}
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-5 text-center text-sm font-medium">
            {"🎨 选择你的风格偏好"}
          </div>
          <div className="rounded-2xl border border-border bg-white px-4 py-5 text-center text-sm font-medium">
            {"✨ 30秒生成效果图"}
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-6 md:px-8 md:pb-20">
        <div className="mx-auto flex w-full max-w-5xl justify-center">
          <Link
            href="/create"
            className="inline-flex h-[52px] min-w-[240px] items-center justify-center rounded-xl bg-[#8B5A37] px-8 text-base font-semibold text-white transition-colors hover:bg-[#754a2f]"
          >
            {"免费开始"}
          </Link>
        </div>
      </section>
    </main>
  );
}
