"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CircleAlert,
  CircleCheckBig,
  ImageIcon,
  Lock,
  PackagePlus,
  ShoppingBag,
  Sparkles,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { BackLinkButton } from "@/components/BackLinkButton";
import { BudgetSlider } from "@/components/furnishing/BudgetSlider";
import { PurchaseProgress } from "@/components/furnishing/PurchaseProgress";
import { ShareCard } from "@/components/furnishing/ShareCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFurnishingStore } from "@/lib/store/furnishingStore";
import type { FurnishingPlan, FurnishingPlanItem } from "@/lib/types";

type ProductSummary = {
  name: string;
  image_url: string;
  price_min: number;
  price_max: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  brand: string | null;
  source_url: string | null;
};

type PlanItemEntry = FurnishingPlanItem & {
  products: ProductSummary | null;
};

type RoomSummary = {
  id: string;
  home_id: string;
  name: string;
  room_type: string;
  original_photo_url: string | null;
  current_photo_url: string | null;
};

type PlanResponse = FurnishingPlan & {
  rooms: RoomSummary | RoomSummary[] | null;
  furnishing_plan_items: PlanItemEntry[];
};

const copy = {
  zh: {
    title: "软装清单",
    budget: "总预算",
    itemList: "商品清单",
    addItem: "添加商品",
    generate: "生成效果图",
    share: "分享清单",
    purchased: "已购买",
    recommended: "推荐",
    abandoned: "已放弃",
    lock: "锁定",
    unlock: "解锁",
    markPurchased: "标记已购买",
    aiRecommended: "AI 推荐",
    userPicked: "你选的",
    fitConfirmed: "尺寸已确认",
    fitWarning: "尺寸有提醒",
    fitBlocked: "尺寸不建议",
    fitPending: "待校验",
    roomPhoto: "房间照片",
    noItems: "还没有商品",
    noItemsDescription: "先往这个 Plan 里放几件商品，预算和状态管理就会开始工作。",
    draft: "进行中",
  },
  en: {
    title: "Furnishing Cart",
  },
} as const;

const CATEGORY_OPTIONS = [
  { value: "sofa", label: "沙发" },
  { value: "coffee_table", label: "茶几" },
  { value: "tv_cabinet", label: "电视柜" },
  { value: "bed", label: "床" },
  { value: "dining_table", label: "餐桌" },
  { value: "wardrobe", label: "衣柜" },
  { value: "curtain", label: "窗帘" },
  { value: "rug", label: "地毯" },
  { value: "floor_lamp", label: "落地灯" },
  { value: "painting", label: "装饰画" },
  { value: "pillow", label: "抱枕" },
  { value: "side_table", label: "边几" },
  { value: "plant", label: "绿植" },
] as const;

const uiText = {
  title: "软装清单",
  budget: "总预算",
  itemList: "商品清单",
  addItem: "添加商品",
  generate: "生成效果图",
  share: "分享清单",
  purchased: "已购买",
  recommended: "推荐中",
  abandoned: "已放弃",
  lock: "锁定",
  unlock: "解锁",
  markPurchased: "标记已购买",
  aiRecommended: "AI 推荐",
  userPicked: "手动添加",
  fitConfirmed: "尺寸已确认",
  fitWarning: "尺寸有提醒",
  fitBlocked: "尺寸不建议",
  fitPending: "待校验",
  roomPhoto: "房间照片",
  noItems: "还没有商品",
  noItemsDescription: "先手动添加第一件商品，后面就能开始跑预算、分享和效果图流程。",
  draft: "进行中",
} as const;

interface FurnishingPlanPageClientProps {
  planId: string;
}

export default function FurnishingPlanPageClient({
  planId,
}: FurnishingPlanPageClientProps) {
  const t = uiText;
  const router = useRouter();
  const [roomInfo, setRoomInfo] = useState<RoomSummary | null>(null);
  const [itemEntries, setItemEntries] = useState<PlanItemEntry[]>([]);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCreatingItem, setIsCreatingItem] = useState(false);
  const [formState, setFormState] = useState({
    name: "",
    category: "sofa",
    imageUrl: "",
    sourceUrl: "",
    widthMm: "",
    depthMm: "",
    heightMm: "",
    price: "",
  });
  const currentPlan = useFurnishingStore((state) => state.currentPlan);
  const setPlan = useFurnishingStore((state) => state.setPlan);
  const setItems = useFurnishingStore((state) => state.setItems);
  const setLoading = useFurnishingStore((state) => state.setLoading);
  const isLoading = useFurnishingStore((state) => state.isLoading);
  const updateBudget = useFurnishingStore((state) => state.updateBudget);

  const resolvedPlanId = planId;

  useEffect(() => {
    if (!resolvedPlanId) {
      return;
    }

    let ignore = false;

    async function loadPlan() {
      setLoading(true);

      try {
        const response = await fetch(`/api/furnishing/plan/${resolvedPlanId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as { success: boolean; data?: PlanResponse; error?: string };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "加载软装清单失败");
        }

        const room = Array.isArray(payload.data.rooms)
          ? payload.data.rooms[0] || null
          : payload.data.rooms || null;
        const sortedItems = [...(payload.data.furnishing_plan_items || [])].sort(
          (left, right) => left.sort_order - right.sort_order,
        );

        if (!ignore) {
          syncPlanState(payload.data, sortedItems, setPlan, setItems);
          setItemEntries(sortedItems);
          setRoomInfo(room);
        }
      } catch (error) {
        if (!ignore) {
          toast.error(error instanceof Error ? error.message : "加载软装清单失败");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadPlan();

    return () => {
      ignore = true;
    };
  }, [resolvedPlanId, setItems, setLoading, setPlan]);

  const purchasedCount = itemEntries.filter((item) => item.status === "purchased").length;
  const totalCount = itemEntries.filter((item) => item.status !== "abandoned").length;
  const lockedTotal = itemEntries
    .filter((item) => item.locked && item.price != null)
    .reduce((sum, item) => sum + (item.price ?? 0), 0);
  const totalBudget = currentPlan?.total_budget ?? 0;
  const spentAmount =
    currentPlan?.current_total ?? itemEntries.reduce((sum, item) => sum + (item.price ?? 0), 0);
  const remainingBudget = totalBudget - spentAmount;
  const progressRatio = totalBudget > 0 ? Math.min(Math.max(spentAmount / totalBudget, 0), 1.25) : 0;

  const progressColor = useMemo(() => {
    if (totalBudget <= 0) {
      return "bg-muted";
    }

    if (spentAmount / totalBudget > 1) {
      return "bg-destructive";
    }

    if (spentAmount / totalBudget >= 0.8) {
      return "bg-amber-500";
    }

    return "bg-emerald-500";
  }, [spentAmount, totalBudget]);

  async function reloadPlan() {
    if (!resolvedPlanId) {
      return;
    }

    const response = await fetch(`/api/furnishing/plan/${resolvedPlanId}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as { success: boolean; data?: PlanResponse; error?: string };

    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error || "刷新软装清单失败");
    }

    const room = Array.isArray(payload.data.rooms)
      ? payload.data.rooms[0] || null
      : payload.data.rooms || null;
    const sortedItems = [...(payload.data.furnishing_plan_items || [])].sort(
      (left, right) => left.sort_order - right.sort_order,
    );

    syncPlanState(payload.data, sortedItems, setPlan, setItems);
    setItemEntries(sortedItems);
    setRoomInfo(room);
  }

  async function handleBudgetChange(nextBudget: number) {
    if (!resolvedPlanId || isSavingBudget) {
      return;
    }

    setIsSavingBudget(true);

    try {
      const response = await fetch("/api/furnishing/adjust-budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan_id: resolvedPlanId, new_budget: nextBudget }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: { remaining: number; locked_total: number };
        error?: string;
      };

      updateBudget(nextBudget);
      await reloadPlan();

      if (!response.ok || !payload.success) {
        toast.warning(payload.error || "预算已更新，但锁定商品已经超出预算");
      } else {
        toast.success("预算已更新");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "调整预算失败");
    } finally {
      setIsSavingBudget(false);
    }
  }

  async function handleToggleLock(item: PlanItemEntry) {
    setActiveItemId(item.id);

    try {
      const response = await fetch(`/api/furnishing/item/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !item.locked }),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "更新锁定状态失败");
      }

      await reloadPlan();
      toast.success(item.locked ? "已解锁商品" : "已锁定商品");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新锁定状态失败");
    } finally {
      setActiveItemId(null);
    }
  }

  async function handleMarkPurchased(item: PlanItemEntry) {
    setActiveItemId(item.id);

    try {
      const response = await fetch(`/api/furnishing/item/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "purchased" }),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "标记购买失败");
      }

      await reloadPlan();
      toast.success("已标记为购买");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "标记购买失败");
    } finally {
      setActiveItemId(null);
    }
  }

  async function handleCreateItem() {
    if (!resolvedPlanId) {
      return;
    }

    if (
      !formState.name.trim() ||
      !formState.imageUrl.trim() ||
      !formState.widthMm.trim() ||
      !formState.depthMm.trim() ||
      !formState.heightMm.trim()
    ) {
      toast.error("请完整填写名称、图片 URL 和尺寸信息");
      return;
    }

    const widthMm = Number(formState.widthMm);
    const depthMm = Number(formState.depthMm);
    const heightMm = Number(formState.heightMm);
    const price = formState.price.trim() ? Number(formState.price) : null;

    if ([widthMm, depthMm, heightMm].some((value) => !Number.isFinite(value) || value <= 0)) {
      toast.error("尺寸必须是大于 0 的数字");
      return;
    }

    if (price != null && (!Number.isFinite(price) || price <= 0)) {
      toast.error("价格填写时必须是大于 0 的数字");
      return;
    }

    setIsCreatingItem(true);

    try {
      const response = await fetch("/api/furnishing/item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan_id: resolvedPlanId,
          category: formState.category,
          source: "user_uploaded",
          custom_name: formState.name.trim(),
          custom_image_url: formState.imageUrl.trim(),
          custom_source_url: formState.sourceUrl.trim() || null,
          custom_width_mm: widthMm,
          custom_depth_mm: depthMm,
          custom_height_mm: heightMm,
          price,
        }),
      });

      const payload = (await response.json()) as { success: boolean; error?: string };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "添加商品失败");
      }

      await reloadPlan();
      setDialogOpen(false);
      setFormState({
        name: "",
        category: "sofa",
        imageUrl: "",
        sourceUrl: "",
        widthMm: "",
        depthMm: "",
        heightMm: "",
        price: "",
      });
      toast.success("商品已添加到软装清单");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加商品失败");
    } finally {
      setIsCreatingItem(false);
    }
  }

  function handleScrollToShare() {
    const element = document.getElementById("plan-share-card");
    if (!element) {
      toast.info("分享卡正在准备中");
      return;
    }

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function handleGeneratePreview() {
    if (!resolvedPlanId) {
      toast.info("方案仍在加载，请稍后重试");
      return;
    }

    if (itemEntries.length === 0) {
      toast.info("先添加至少一件商品，再生成效果图");
      return;
    }

    router.push(`/generate/${resolvedPlanId}`);
  }

  const roomPhoto = roomInfo?.current_photo_url || roomInfo?.original_photo_url;
  const shareItems = itemEntries
    .filter((item) => item.status !== "abandoned")
    .map((item) => ({
      id: item.id,
      name:
        item.custom_name ||
        item.products?.name ||
        ROOM_CATEGORY_LABELS[item.category] ||
        item.category,
      category: item.category,
      status: item.status,
      price: item.price,
      priceRangeMin: item.price_range_min ?? item.products?.price_min ?? null,
      priceRangeMax: item.price_range_max ?? item.products?.price_max ?? null,
    }));

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLinkButton href={roomInfo?.home_id ? `/home/${roomInfo.home_id}` : "/dashboard"} />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>我的家</span>
          <span>·</span>
          <span>{roomInfo?.name || "Room"}</span>
          <span>·</span>
          <span>{currentPlan?.name || t.title}</span>
        </div>
        <div className="rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
          {currentPlan?.status || t.draft}
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Card className="overflow-hidden border-border bg-card">
          <div className="relative aspect-[16/9] bg-muted/30">
            {roomPhoto ? (
              <Image
                src={roomPhoto}
                alt={t.roomPhoto}
                fill
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                <ImageIcon className="h-10 w-10" />
              </div>
            )}
          </div>
        </Card>

        <Card className="border-border bg-card">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl font-serif">{currentPlan?.name || t.title}</CardTitle>
            <CardDescription>
              {roomInfo?.name || "未关联 Room"} · {roomInfo?.room_type ? roomInfo.room_type.replaceAll("_", " ") : "待补充类型"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{t.budget}</p>
              <p className="text-3xl font-semibold text-foreground">{formatCurrency(totalBudget)}</p>
            </div>

            <div className="space-y-2">
              <div className="h-3 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full rounded-full transition-all ${progressColor}`}
                  style={{ width: `${Math.min(progressRatio * 100, 100)}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                已购 {purchasedCount}/{totalCount} 件 | 已花费 {formatCurrency(spentAmount)} | 剩余{" "}
                <span className={remainingBudget < 0 ? "text-destructive" : "text-foreground"}>
                  {formatCurrency(remainingBudget)}
                </span>
              </p>
            </div>

            <BudgetSlider
              totalBudget={totalBudget}
              lockedTotal={lockedTotal}
              onBudgetChange={handleBudgetChange}
            />
          </CardContent>
        </Card>
      </section>

      <PurchaseProgress
        purchasedCount={purchasedCount}
        totalCount={totalCount}
        spentAmount={spentAmount}
        remainingBudget={remainingBudget}
      />

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-serif text-foreground">{t.itemList}</h2>
            <p className="text-sm text-muted-foreground">管理锁定状态、购买状态和预算变化。</p>
          </div>
          <Button onClick={() => setDialogOpen(true)}>
            <PackagePlus className="h-4 w-4" />
            {t.addItem}
          </Button>
        </div>

        {isLoading ? (
          <Card className="border-border bg-card">
            <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
              正在加载软装清单...
            </CardContent>
          </Card>
        ) : itemEntries.length > 0 ? (
          <div className="space-y-4">
            {itemEntries.map((item) => {
              const itemImage = item.custom_image_url || item.products?.image_url || null;
              const itemName =
                item.custom_name ||
                item.products?.name ||
                ROOM_CATEGORY_LABELS[item.category] ||
                item.category;
              const isPurchased = item.status === "purchased";
              const isAbandoned = item.status === "abandoned";
              const fitMeta = getFitMeta(item.fit_status);

              return (
                <Card
                  key={item.id}
                  className={`border-border ${
                    isPurchased
                      ? "bg-emerald-50/60"
                      : isAbandoned
                        ? "bg-muted/60"
                        : "bg-card"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row">
                      <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-2xl border bg-muted/30 md:w-36">
                        {itemImage ? (
                          <Image
                            src={itemImage}
                            alt={itemName}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-muted-foreground">
                            <ImageIcon className="h-8 w-8" />
                          </div>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-2">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                                {ROOM_CATEGORY_LABELS[item.category] || item.category}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                                  item.source === "ai_recommended"
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-primary/10 text-primary"
                                }`}
                              >
                                {item.source === "ai_recommended" ? t.aiRecommended : t.userPicked}
                              </span>
                              <span className="rounded-full bg-background px-2.5 py-1 text-xs font-medium text-foreground">
                                {STATUS_LABELS[item.status] || item.status}
                              </span>
                            </div>
                            <h3
                              className={`text-lg font-semibold text-foreground ${
                                isAbandoned ? "line-through opacity-60" : ""
                              }`}
                            >
                              {itemName}
                            </h3>
                            <p
                              className={`text-sm ${
                                isAbandoned ? "line-through text-muted-foreground" : "text-foreground"
                              }`}
                            >
                              {formatItemPrice(item)}
                            </p>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={activeItemId === item.id}
                              onClick={() => void handleToggleLock(item)}
                            >
                              {item.locked ? (
                                <>
                                  <Unlock className="h-4 w-4" />
                                  {t.unlock}
                                </>
                              ) : (
                                <>
                                  <Lock className="h-4 w-4" />
                                  {t.lock}
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              disabled={activeItemId === item.id || isPurchased}
                              onClick={() => void handleMarkPurchased(item)}
                            >
                              <ShoppingBag className="h-4 w-4" />
                              {isPurchased ? t.purchased : t.markPurchased}
                            </Button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            {fitMeta.icon}
                            {fitMeta.label}
                          </span>
                          <span>{formatItemDimensions(item)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle className="text-xl font-serif">{t.noItems}</CardTitle>
              <CardDescription>{t.noItemsDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex h-48 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/40 px-6 text-center text-muted-foreground">
                <PackagePlus className="h-10 w-10" />
                <p>先添加第一件商品，后面就能继续生成效果图、调整预算和分享清单。</p>
              </div>
              <Button className="h-12 w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
                <PackagePlus className="h-4 w-4" />
                {t.addItem}
              </Button>
            </CardContent>
          </Card>
        )}
      </section>

      {currentPlan ? (
        <ShareCard
          plan={{
            id: currentPlan.id,
            name: currentPlan.name || t.title,
            total_budget: currentPlan.total_budget,
            current_total: currentPlan.current_total,
          }}
          items={shareItems}
          effectImageUrl={roomPhoto ?? undefined}
        />
      ) : null}

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur md:flex-row">
        <Button
          variant="outline"
          className="h-12 flex-1"
          onClick={() => setDialogOpen(true)}
        >
          {t.addItem}
        </Button>
        <Button
          variant="outline"
          className="h-12 flex-1"
          onClick={handleGeneratePreview}
        >
          <Sparkles className="h-4 w-4" />
          {t.generate}
        </Button>
        <Button className="h-12 flex-1" onClick={handleScrollToShare}>
          {t.share}
        </Button>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>快速手动添加商品</DialogTitle>
            <DialogDescription>
              先填写名称、品类、图片 URL 和尺寸，价格与来源链接可选。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="item-name">商品名称</Label>
              <Input
                id="item-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="例如：云朵三人位沙发"
              />
            </div>

            <div className="space-y-2">
              <Label>品类</Label>
              <Select
                value={formState.category}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, category: value }))
                }
              >
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
              <Label htmlFor="item-price">价格（选填）</Label>
              <Input
                id="item-price"
                inputMode="numeric"
                value={formState.price}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, price: event.target.value }))
                }
                placeholder="例如：5999（选填）"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="item-image-url">商品图片 URL</Label>
              <Input
                id="item-image-url"
                value={formState.imageUrl}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, imageUrl: event.target.value }))
                }
                placeholder="粘贴可直接访问的商品主图链接"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="item-source-url">来源链接（选填）</Label>
              <Input
                id="item-source-url"
                value={formState.sourceUrl}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, sourceUrl: event.target.value }))
                }
                placeholder="例如：商品详情页链接"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-width">宽度 mm</Label>
              <Input
                id="item-width"
                inputMode="numeric"
                value={formState.widthMm}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, widthMm: event.target.value }))
                }
                placeholder="例如：2200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-depth">深度 mm</Label>
              <Input
                id="item-depth"
                inputMode="numeric"
                value={formState.depthMm}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, depthMm: event.target.value }))
                }
                placeholder="例如：950"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="item-height">高度 mm</Label>
              <Input
                id="item-height"
                inputMode="numeric"
                value={formState.heightMm}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, heightMm: event.target.value }))
                }
                placeholder="例如：780"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={() => void handleCreateItem()} disabled={isCreatingItem}>
              {isCreatingItem ? "添加中..." : "添加到软装清单"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function syncPlanState(
  plan: PlanResponse,
  sortedItems: PlanItemEntry[],
  setPlan: (plan: FurnishingPlan) => void,
  setItems: (items: FurnishingPlanItem[]) => void,
) {
  setPlan({
    id: plan.id,
    room_id: plan.room_id,
    name: plan.name,
    total_budget: plan.total_budget,
    current_total: plan.current_total,
    style_preference: plan.style_preference,
    status: plan.status,
    created_at: plan.created_at,
    updated_at: plan.updated_at,
  });

  setItems(
    sortedItems.map((item) => ({
      id: item.id,
      plan_id: item.plan_id,
      category: item.category,
      source: item.source,
      locked: item.locked,
      product_id: item.product_id,
      custom_name: item.custom_name,
      custom_image_url: item.custom_image_url,
      custom_source_url: item.custom_source_url,
      custom_width_mm: item.custom_width_mm,
      custom_depth_mm: item.custom_depth_mm,
      custom_height_mm: item.custom_height_mm,
      price: item.price,
      price_range_min: item.price_range_min,
      price_range_max: item.price_range_max,
      fit_status: item.fit_status,
      fit_message: item.fit_message,
      status: item.status,
      purchased_at: item.purchased_at,
      sort_order: item.sort_order,
      created_at: item.created_at,
    })),
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatItemPrice(item: PlanItemEntry) {
  if (item.price != null) {
    return formatCurrency(item.price);
  }

  if (item.price_range_min != null && item.price_range_max != null) {
    return `${formatCurrency(item.price_range_min)} - ${formatCurrency(item.price_range_max)}`;
  }

  if (item.products?.price_min != null && item.products?.price_max != null) {
    return `${formatCurrency(item.products.price_min)} - ${formatCurrency(item.products.price_max)}`;
  }

  return "价格待补充";
}

function formatItemDimensions(item: PlanItemEntry) {
  const width = item.custom_width_mm ?? item.products?.width_mm;
  const depth = item.custom_depth_mm ?? item.products?.depth_mm;
  const height = item.custom_height_mm ?? item.products?.height_mm;

  if (!width || !depth || !height) {
    return "尺寸待补充";
  }

  return `${width} × ${depth} × ${height} mm`;
}

function getFitMeta(status: FurnishingPlanItem["fit_status"]) {
  switch (status) {
    case "confirmed":
      return {
        label: uiText.fitConfirmed,
        icon: <CircleCheckBig className="h-4 w-4 text-emerald-600" />,
      };
    case "warning":
      return {
        label: uiText.fitWarning,
        icon: <CircleAlert className="h-4 w-4 text-amber-500" />,
      };
    case "blocked":
      return {
        label: uiText.fitBlocked,
        icon: <CircleAlert className="h-4 w-4 text-destructive" />,
      };
    default:
      return {
        label: uiText.fitPending,
        icon: <CircleAlert className="h-4 w-4 text-muted-foreground" />,
      };
  }
}

const ROOM_CATEGORY_LABELS: Record<string, string> = {
  sofa: "沙发",
  coffee_table: "茶几",
  tv_cabinet: "电视柜",
  bed: "床",
  dining_table: "餐桌",
  wardrobe: "衣柜",
  curtain: "窗帘",
  rug: "地毯",
  floor_lamp: "落地灯",
  painting: "装饰画",
  pillow: "抱枕",
  side_table: "边几",
  plant: "绿植",
};

const STATUS_LABELS: Record<string, string> = {
  recommended: copy.zh.recommended,
  purchased: copy.zh.purchased,
  abandoned: copy.zh.abandoned,
};

const DISPLAY_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
);

const DISPLAY_STATUS_LABELS: Record<string, string> = {
  recommended: uiText.recommended,
  candidate: "候选",
  confirmed: "已确认",
  purchased: uiText.purchased,
  abandoned: uiText.abandoned,
};

Object.assign(ROOM_CATEGORY_LABELS, DISPLAY_CATEGORY_LABELS);
Object.assign(STATUS_LABELS, DISPLAY_STATUS_LABELS);
