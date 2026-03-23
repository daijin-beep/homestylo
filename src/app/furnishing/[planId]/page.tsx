"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import {
  CircleAlert,
  CircleCheckBig,
  ImageIcon,
  Lock,
  ShoppingBag,
  Sparkles,
  Unlock,
} from "lucide-react";
import { toast } from "sonner";
import { BackLinkButton } from "@/components/BackLinkButton";
import { BudgetSlider } from "@/components/furnishing/BudgetSlider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export default function FurnishingPlanPage({
  params,
}: {
  params: Promise<{ planId: string }>;
}) {
  const t = copy.zh;
  const [resolvedPlanId, setResolvedPlanId] = useState<string | null>(null);
  const [roomInfo, setRoomInfo] = useState<RoomSummary | null>(null);
  const [itemEntries, setItemEntries] = useState<PlanItemEntry[]>([]);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const {
    currentPlan,
    setPlan,
    setItems,
    setLoading,
    isLoading,
    updateBudget,
  } = useFurnishingStore((state) => ({
    currentPlan: state.currentPlan,
    setPlan: state.setPlan,
    setItems: state.setItems,
    setLoading: state.setLoading,
    isLoading: state.isLoading,
    updateBudget: state.updateBudget,
  }));

  useEffect(() => {
    let ignore = false;

    params.then(({ planId }) => {
      if (!ignore) {
        setResolvedPlanId(planId);
      }
    });

    return () => {
      ignore = true;
    };
  }, [params]);

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
          syncPlanState(payload.data, sortedItems, room, setPlan, setItems);
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

    syncPlanState(payload.data, sortedItems, room, setPlan, setItems);
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

  function handlePlaceholder(message: string) {
    toast.info(message);
  }

  const roomPhoto = roomInfo?.current_photo_url || roomInfo?.original_photo_url;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <BackLinkButton href="/dashboard" />
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
              {roomInfo?.name || "未关联 Room"} · {roomInfo?.room_type || "待补充类型"}
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

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-serif text-foreground">{t.itemList}</h2>
            <p className="text-sm text-muted-foreground">管理锁定状态、购买状态和预算变化。</p>
          </div>
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
              <div className="flex h-48 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-muted-foreground">
                这里会显示这个 Plan 里的商品。
              </div>
            </CardContent>
          </Card>
        )}
      </section>

      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-3xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur md:flex-row">
        <Button
          variant="outline"
          className="h-12 flex-1"
          onClick={() => handlePlaceholder("V4 商品导入入口将在后续阶段接入")}
        >
          {t.addItem}
        </Button>
        <Button
          variant="outline"
          className="h-12 flex-1"
          onClick={() => handlePlaceholder("V4 效果图生成入口将在后续阶段接入")}
        >
          <Sparkles className="h-4 w-4" />
          {t.generate}
        </Button>
        <Button className="h-12 flex-1" onClick={() => handlePlaceholder("清单分享卡会在 8.6 接入")}>
          {t.share}
        </Button>
      </div>
    </main>
  );
}

function syncPlanState(
  plan: PlanResponse,
  sortedItems: PlanItemEntry[],
  room: RoomSummary | null,
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

  void room;
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
        label: copy.zh.fitConfirmed,
        icon: <CircleCheckBig className="h-4 w-4 text-emerald-600" />,
      };
    case "warning":
      return {
        label: copy.zh.fitWarning,
        icon: <CircleAlert className="h-4 w-4 text-amber-500" />,
      };
    case "blocked":
      return {
        label: copy.zh.fitBlocked,
        icon: <CircleAlert className="h-4 w-4 text-destructive" />,
      };
    default:
      return {
        label: copy.zh.fitPending,
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
