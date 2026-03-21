"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { STYLE_DEFINITIONS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface HeroProductItem {
  id: string;
  name: string;
  brand: string | null;
  image_url: string;
  price_min: number;
  price_max: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  category: string;
  style: string;
}

interface ProductImportClientProps {
  schemeId: string;
  schemeStyle: string | null;
  replaceProductId: string | null;
  category: string | null;
  heroProducts: HeroProductItem[];
}

const CATEGORY_OPTIONS = [
  { value: "sofa", label: "沙发" },
  { value: "coffee_table", label: "茶几" },
  { value: "tv_cabinet", label: "电视柜" },
  { value: "rug", label: "地毯" },
  { value: "floor_lamp", label: "落地灯" },
  { value: "side_table", label: "边几" },
  { value: "bed", label: "床" },
  { value: "dining_table", label: "餐桌" },
  { value: "painting", label: "装饰画" },
  { value: "curtain", label: "窗帘" },
];

function formatPrice(min: number, max: number) {
  if (min <= 0 && max <= 0) {
    return "价格待补充";
  }

  if (min === max) {
    return `¥${new Intl.NumberFormat("zh-CN").format(min)}`;
  }

  return `¥${new Intl.NumberFormat("zh-CN").format(min)} - ¥${new Intl.NumberFormat(
    "zh-CN",
  ).format(max)}`;
}

export function ProductImportClient({
  schemeId,
  schemeStyle,
  replaceProductId,
  category,
  heroProducts,
}: ProductImportClientProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"hero" | "manual">("hero");
  const [selectedStyle, setSelectedStyle] = useState<string>(schemeStyle ?? "all");
  const [selectedCategory, setSelectedCategory] = useState<string>(category ?? "sofa");
  const [manualName, setManualName] = useState("");
  const [manualCategory, setManualCategory] = useState(category ?? "sofa");
  const [widthMm, setWidthMm] = useState("");
  const [depthMm, setDepthMm] = useState("");
  const [heightMm, setHeightMm] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [manualScreenshot, setManualScreenshot] = useState<File | null>(null);
  const [manualPreview, setManualPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    return () => {
      if (manualPreview) {
        URL.revokeObjectURL(manualPreview);
      }
    };
  }, [manualPreview]);

  const filteredHeroProducts = useMemo(
    () =>
      heroProducts.filter((item) => {
        if (selectedCategory && item.category !== selectedCategory) {
          return false;
        }

        if (selectedStyle !== "all" && item.style !== selectedStyle) {
          return false;
        }

        return true;
      }),
    [heroProducts, selectedCategory, selectedStyle],
  );

  const handleManualScreenshotChange = (file: File | null) => {
    if (manualPreview) {
      URL.revokeObjectURL(manualPreview);
    }

    if (!file) {
      setManualScreenshot(null);
      setManualPreview(null);
      return;
    }

    setManualScreenshot(file);
    setManualPreview(URL.createObjectURL(file));
  };

  const submitHeroProduct = async (productId: string) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("mode", "hero");
      formData.set("scheme_id", schemeId);
      formData.set("product_id", productId);
      formData.set("category", selectedCategory);
      if (replaceProductId) {
        formData.set("replace_product_id", replaceProductId);
      }

      const response = await fetch("/api/product/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || payload.success === false || !payload.redirectTo) {
        throw new Error(payload.error ?? "Hero 商品导入失败。");
      }

      toast.success("商品已加入当前方案。");
      router.push(payload.redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitManualProduct = async () => {
    if (!manualScreenshot) {
      toast.error("请先上传商品截图。");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("mode", "manual");
      formData.set("scheme_id", schemeId);
      formData.set("name", manualName);
      formData.set("manual_category", manualCategory);
      formData.set("width_mm", widthMm);
      formData.set("depth_mm", depthMm);
      formData.set("height_mm", heightMm);
      formData.set("price_min", priceMin);
      formData.set("price_max", priceMax);
      formData.set("source_url", sourceUrl);
      formData.set("screenshot", manualScreenshot);
      if (replaceProductId) {
        formData.set("replace_product_id", replaceProductId);
      }

      const response = await fetch("/api/product/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || payload.success === false || !payload.redirectTo) {
        throw new Error(payload.error ?? "手动导入失败。");
      }

      toast.success("自定义商品已导入方案。");
      router.push(payload.redirectTo);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "导入失败，请稍后重试。");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <section className="overflow-hidden rounded-3xl border border-[#e5d8c7] bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),_rgba(245,240,233,0.98))] p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">
              商品导入
            </p>
            <h1 className="font-serif text-3xl font-semibold text-foreground">
              {replaceProductId ? "替换当前家具" : "把新商品加入你的方案"}
            </h1>
            <p className="max-w-2xl text-sm text-muted-foreground">
              支持从 Hero SKU 库快速选择，也支持上传商品截图并手动录入尺寸。导入后会返回结果页。
            </p>
          </div>

          <div className="rounded-2xl border border-[#eadfce] bg-white/80 px-4 py-3 text-sm text-[#7c6043]">
            <p>{`方案 ID：${schemeId.slice(0, 8)}`}</p>
            <p>{`当前品类：${selectedCategory}`}</p>
          </div>
        </div>
      </section>

      <Tabs
        value={mode}
        onValueChange={(value) => setMode(value as "hero" | "manual")}
        className="space-y-4"
      >
        <TabsList className="h-auto rounded-2xl bg-[#ede3d6] p-1">
          <TabsTrigger value="hero" className="rounded-xl px-4 py-2">
            从推荐库选
          </TabsTrigger>
          <TabsTrigger value="manual" className="rounded-xl px-4 py-2">
            自己导入
          </TabsTrigger>
        </TabsList>

        <TabsContent value="hero" className="space-y-4">
          <section className="grid gap-4 rounded-2xl border border-border bg-white p-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">品类</p>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="选择品类" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">风格筛选</p>
              <Select value={selectedStyle} onValueChange={setSelectedStyle}>
                <SelectTrigger>
                  <SelectValue placeholder="选择风格" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部风格</SelectItem>
                  {Object.entries(STYLE_DEFINITIONS).map(([style, definition]) => (
                    <SelectItem key={style} value={style}>
                      {definition.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {filteredHeroProducts.length > 0 ? (
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filteredHeroProducts.map((product) => (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-2xl border border-border bg-white shadow-sm"
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden">
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1280px) 50vw, 33vw"
                      unoptimized={product.image_url.startsWith("http")}
                    />
                  </div>
                  <div className="space-y-3 p-4">
                    <div className="space-y-1">
                      <p className="line-clamp-2 text-base font-semibold text-foreground">
                        {product.name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {product.brand ??
                          STYLE_DEFINITIONS[
                            product.style as keyof typeof STYLE_DEFINITIONS
                          ]?.label ??
                          product.style}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div className="rounded-lg bg-[#f7f2ea] px-3 py-2">
                        {`${product.width_mm} × ${product.depth_mm} × ${product.height_mm}mm`}
                      </div>
                      <div className="rounded-lg bg-[#f7f2ea] px-3 py-2 text-[#8B5A37]">
                        {formatPrice(product.price_min, product.price_max)}
                      </div>
                    </div>

                    <Button
                      type="button"
                      className="w-full bg-[#8B5A37] text-white hover:bg-[#754a2f]"
                      onClick={() => submitHeroProduct(product.id)}
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          导入中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          选择这个
                        </>
                      )}
                    </Button>
                  </div>
                </article>
              ))}
            </section>
          ) : (
            <section className="rounded-2xl border border-dashed border-border bg-white px-6 py-14 text-center text-sm text-muted-foreground">
              当前筛选条件下没有可选 Hero 商品，可以切换风格，或者改用“自己导入”。
            </section>
          )}
        </TabsContent>

        <TabsContent value="manual" className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="space-y-4 rounded-2xl border border-border bg-white p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">商品名称</span>
                <Input
                  value={manualName}
                  onChange={(event) => setManualName(event.target.value)}
                  placeholder="例如：云朵弧形沙发"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">品类</span>
                <Select value={manualCategory} onValueChange={setManualCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择品类" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORY_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">宽度 mm</span>
                <Input
                  value={widthMm}
                  onChange={(event) => setWidthMm(event.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">深度 mm</span>
                <Input
                  value={depthMm}
                  onChange={(event) => setDepthMm(event.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">高度 mm</span>
                <Input
                  value={heightMm}
                  onChange={(event) => setHeightMm(event.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">价格区间下限</span>
                <Input
                  value={priceMin}
                  onChange={(event) => setPriceMin(event.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-foreground">价格区间上限</span>
                <Input
                  value={priceMax}
                  onChange={(event) => setPriceMax(event.target.value)}
                  inputMode="numeric"
                />
              </label>
            </div>

            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">来源链接（选填）</span>
              <Input
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                placeholder="https://..."
              />
            </label>

            <div className="rounded-2xl border border-dashed border-[#d8c7b2] bg-[#faf5ee] p-5">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-3 text-center">
                <div className="rounded-full bg-white p-3 text-[#8B5A37] shadow-sm">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">上传商品截图</p>
                  <p className="text-xs text-muted-foreground">
                    建议使用清晰主图，便于后续效果图识别。
                  </p>
                </div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) =>
                    handleManualScreenshotChange(event.target.files?.[0] ?? null)
                  }
                />
                <span className="rounded-full border border-[#d2c0a9] bg-white px-3 py-1 text-xs font-medium text-[#8B5A37]">
                  选择图片
                </span>
              </label>
            </div>

            <Button
              type="button"
              className="w-full bg-[#8B5A37] text-white hover:bg-[#754a2f]"
              onClick={submitManualProduct}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  导入中...
                </>
              ) : (
                "导入并加入方案"
              )}
            </Button>
          </section>

          <aside className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-border bg-white">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-base font-semibold text-foreground">截图预览</h2>
              </div>
              <div className="relative aspect-[4/3] w-full bg-[#f6f1ea]">
                {manualPreview ? (
                  <Image
                    src={manualPreview}
                    alt="商品截图预览"
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 400px"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                    上传后将在这里显示商品主图预览。
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-white p-4 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">导入提示</p>
              <p className="mt-2">
                手动导入会先创建一条新的 <code>products</code> 记录，再加入当前方案。
              </p>
              <p className="mt-2">
                如果当前是替换模式，原商品会保留为历史记录，方便后续做三选一对比。
              </p>
            </section>
          </aside>
        </TabsContent>
      </Tabs>
    </main>
  );
}
