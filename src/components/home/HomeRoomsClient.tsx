"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  DoorOpen,
  ImageIcon,
  PencilLine,
  Plus,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { BackLinkButton } from "@/components/BackLinkButton";
import { RoomPhotoUploader } from "@/components/home/RoomPhotoUploader";
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
import { useHomeStore } from "@/lib/store/homeStore";
import type { Home, Room, SpatialAnalysis } from "@/lib/types";

type PlanSummary = {
  id: string;
  name: string;
  total_budget: number | null;
  current_total: number;
  status: string;
};

type RoomEntry = Room & {
  furnishing_plans: PlanSummary[];
};

type HomeResponse = Home & {
  rooms: RoomEntry[];
};

const ROOM_TYPE_OPTIONS = [
  { value: "living_room", label: "客厅" },
  { value: "bedroom", label: "卧室" },
  { value: "dining_room", label: "餐厅" },
  { value: "study", label: "书房" },
  { value: "kitchen", label: "厨房" },
  { value: "bathroom", label: "卫浴" },
  { value: "other", label: "其他" },
] as const;

const ROOM_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  ROOM_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

const HOME_TYPE_LABELS: Record<string, string> = {
  new_build: "精装房",
  renovation: "翻新",
  occupied: "已入住",
};

const HOME_STATUS_LABELS: Record<string, string> = {
  configuring: "筹备中",
  mostly_done: "基本就绪",
  maintaining: "持续优化",
};

const PLAN_STATUS_LABELS: Record<string, string> = {
  draft: "草稿",
  browsing: "选品中",
  partial_purchase: "部分已购",
  completed: "已完成",
};

export function HomeRoomsClient({ homeId }: { homeId: string }) {
  const router = useRouter();
  const {
    currentHome,
    setHome,
    setRooms,
    addRoom,
    setLoading,
    isLoading,
  } = useHomeStore((state) => ({
    currentHome: state.currentHome,
    setHome: state.setHome,
    setRooms: state.setRooms,
    addRoom: state.addRoom,
    setLoading: state.setLoading,
    isLoading: state.isLoading,
  }));
  const [roomEntries, setRoomEntries] = useState<RoomEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    name: "",
    roomType: "living_room",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  async function loadHomeData() {
    setLoading(true);

    try {
      const response = await fetch(`/api/home/${homeId}`, { cache: "no-store" });
      const payload = (await response.json()) as {
        success: boolean;
        data?: HomeResponse;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "加载 Home 详情失败");
      }

      setHome({
        id: payload.data.id,
        user_id: payload.data.user_id,
        name: payload.data.name,
        home_type: payload.data.home_type,
        status: payload.data.status,
        address: payload.data.address,
        created_at: payload.data.created_at,
        updated_at: payload.data.updated_at,
      });
      setRooms(
        payload.data.rooms.map((room) => ({
          id: room.id,
          home_id: room.home_id,
          name: room.name,
          room_type: room.room_type,
          original_photo_url: room.original_photo_url,
          current_photo_url: room.current_photo_url,
          floor_plan_url: room.floor_plan_url,
          spatial_analysis: room.spatial_analysis,
          depth_map_url: room.depth_map_url,
          camera_params: room.camera_params,
          created_at: room.created_at,
          updated_at: room.updated_at,
        })),
      );
      setRoomEntries(payload.data.rooms);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "加载 Home 详情失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let ignore = false;

    async function loadInitialHome() {
      setLoading(true);

      try {
        const response = await fetch(`/api/home/${homeId}`, { cache: "no-store" });
        const payload = (await response.json()) as {
          success: boolean;
          data?: HomeResponse;
          error?: string;
        };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "加载 Home 详情失败");
        }

        if (ignore) {
          return;
        }

        setHome({
          id: payload.data.id,
          user_id: payload.data.user_id,
          name: payload.data.name,
          home_type: payload.data.home_type,
          status: payload.data.status,
          address: payload.data.address,
          created_at: payload.data.created_at,
          updated_at: payload.data.updated_at,
        });
        setRooms(
          payload.data.rooms.map((room) => ({
            id: room.id,
            home_id: room.home_id,
            name: room.name,
            room_type: room.room_type,
            original_photo_url: room.original_photo_url,
            current_photo_url: room.current_photo_url,
            floor_plan_url: room.floor_plan_url,
            spatial_analysis: room.spatial_analysis,
            depth_map_url: room.depth_map_url,
            camera_params: room.camera_params,
            created_at: room.created_at,
            updated_at: room.updated_at,
          })),
        );
        setRoomEntries(payload.data.rooms);
      } catch (error) {
        if (!ignore) {
          toast.error(error instanceof Error ? error.message : "加载 Home 详情失败");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadInitialHome();

    return () => {
      ignore = true;
    };
  }, [homeId, setHome, setLoading, setRooms]);

  const roomCountLabel = useMemo(() => `${roomEntries.length} 个 Room`, [roomEntries.length]);

  async function handleCreateRoom() {
    if (!formState.name.trim()) {
      toast.error("请先填写 Room 名称");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          home_id: homeId,
          name: formState.name.trim(),
          room_type: formState.roomType,
        }),
      });

      const payload = (await response.json()) as { success: boolean; data?: Room; error?: string };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "创建 Room 失败");
      }

      const room = payload.data;
      addRoom(room);
      setRoomEntries((current) => [
        {
          ...room,
          furnishing_plans: [],
        },
        ...current,
      ]);
      setDialogOpen(false);
      setExpandedRoomId(room.id);
      setFormState({ name: "", roomType: "living_room" });
      toast.success("Room 已创建，请继续上传照片");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建 Room 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreatePlan(room: RoomEntry) {
    setActiveRoomId(room.id);

    try {
      const response = await fetch("/api/furnishing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: room.id }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: PlanSummary;
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "创建软装方案失败");
      }

      setRoomEntries((current) =>
        current.map((entry) =>
          entry.id === room.id
            ? { ...entry, furnishing_plans: [payload.data!, ...entry.furnishing_plans] }
            : entry,
        ),
      );
      toast.success("软装方案已创建");
      router.push(`/furnishing/${payload.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建软装方案失败");
    } finally {
      setActiveRoomId(null);
    }
  }

  function handleRoomAnalysisComplete(roomId: string, analysis: SpatialAnalysis) {
    setRoomEntries((current) =>
      current.map((room) => (room.id === roomId ? { ...room, spatial_analysis: analysis } : room)),
    );
    void loadHomeData();
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <BackLinkButton href="/dashboard" />
        <Button className="h-11" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          添加房间
        </Button>
      </div>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 rounded-3xl border border-border bg-card p-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-serif text-foreground">
                {currentHome?.name || "Home 详情"}
              </h1>
              {currentHome?.home_type ? (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                  {HOME_TYPE_LABELS[currentHome.home_type] || currentHome.home_type}
                </span>
              ) : null}
              {currentHome?.status ? (
                <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {HOME_STATUS_LABELS[currentHome.status] || currentHome.status}
                </span>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground md:text-base">
              {currentHome?.address || "还没有填写地址信息"} · {roomCountLabel}
            </p>
            <p className="max-w-3xl text-sm text-muted-foreground">
              从这里开始管理每一个 Room：上传照片、触发 AI 空间分析、查看分析结果，再创建软装方案。
            </p>
          </div>

          <Button
            variant="outline"
            className="h-11"
            onClick={() => toast.info("Home 编辑能力将在后续阶段补齐")}
          >
            <PencilLine className="h-4 w-4" />
            编辑 Home
          </Button>
        </div>
      </section>

      {isLoading ? (
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            正在加载 Room 列表...
          </CardContent>
        </Card>
      ) : roomEntries.length > 0 ? (
        <section className="space-y-4">
          {roomEntries.map((room) => {
            const thumbnail = room.current_photo_url || room.original_photo_url;
            const isExpanded = expandedRoomId === room.id;
            const analysisState = getAnalysisState(room);

            return (
              <Card key={room.id} className="overflow-hidden border-border bg-card">
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setExpandedRoomId((current) => (current === room.id ? null : room.id))}
                >
                  <CardContent className="p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center">
                      <div className="relative h-44 w-full overflow-hidden rounded-2xl border bg-muted/30 md:h-32 md:w-48">
                        {thumbnail ? (
                          <Image
                            src={thumbnail}
                            alt={room.name}
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
                              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                                {ROOM_TYPE_LABELS[room.room_type] || room.room_type}
                              </span>
                              <span className={analysisState.className}>{analysisState.label}</span>
                            </div>
                            <h2 className="text-2xl font-serif text-foreground">{room.name}</h2>
                            <p className="text-sm text-muted-foreground">
                              {getRoomGuidance(room)}
                            </p>
                          </div>

                          <div className="flex items-center gap-3">
                            <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                              {room.furnishing_plans.length} 个方案
                            </div>
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </button>

                {isExpanded ? (
                  <div className="border-t border-border px-4 pb-4 pt-1">
                    <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                      <RoomPhotoUploader
                        roomId={room.id}
                        existingPhotoUrl={room.original_photo_url}
                        existingFloorPlanUrl={room.floor_plan_url}
                        existingSpatialAnalysis={room.spatial_analysis}
                        onAnalysisComplete={(analysis) => handleRoomAnalysisComplete(room.id, analysis)}
                      />

                      <div className="space-y-4">
                        <Card className="border-border bg-muted/20">
                          <CardHeader className="space-y-2">
                            <CardTitle className="text-lg font-serif">下一步建议</CardTitle>
                            <CardDescription>
                              根据当前状态继续推进，避免卡在半路。
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            {!room.original_photo_url ? (
                              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                                先上传房间照片，AI 才能识别墙面、光线和可摆放区域。
                              </div>
                            ) : !room.spatial_analysis ? (
                              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                                照片已经上传，接下来等待 AI 分析完成，或者点击重新分析。
                              </div>
                            ) : room.furnishing_plans.length === 0 ? (
                              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                                空间分析已完成，现在可以创建第一个软装方案了。
                              </div>
                            ) : (
                              <div className="rounded-2xl border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                                你已经可以继续进入软装清单，添加商品并生成效果图。
                              </div>
                            )}

                            <Button
                              className="h-11 w-full"
                              disabled={!room.spatial_analysis || activeRoomId === room.id}
                              onClick={() => void handleCreatePlan(room)}
                            >
                              <Sparkles className="h-4 w-4" />
                              {activeRoomId === room.id ? "正在创建..." : "创建软装方案"}
                            </Button>
                          </CardContent>
                        </Card>

                        <Card className="border-border bg-card">
                          <CardHeader className="space-y-2">
                            <CardTitle className="text-lg font-serif">已有方案</CardTitle>
                            <CardDescription>
                              创建后可以随时返回这里继续查看或进入软装清单。
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {room.furnishing_plans.length > 0 ? (
                              room.furnishing_plans.map((plan) => (
                                <div
                                  key={plan.id}
                                  className="rounded-2xl border border-border bg-muted/20 p-4"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="space-y-1">
                                      <p className="text-base font-semibold text-foreground">{plan.name}</p>
                                      <p className="text-sm text-muted-foreground">
                                        当前总价 {formatCurrency(plan.current_total)}
                                        {plan.total_budget ? ` / 预算 ${formatCurrency(plan.total_budget)}` : ""}
                                      </p>
                                    </div>
                                    <span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                                      {PLAN_STATUS_LABELS[plan.status] || plan.status}
                                    </span>
                                  </div>

                                  <Button
                                    variant="outline"
                                    className="mt-3 h-10 w-full"
                                    onClick={() => router.push(`/furnishing/${plan.id}`)}
                                  >
                                    进入软装清单
                                  </Button>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-5 text-sm text-muted-foreground">
                                还没有软装方案。先上传照片并完成分析，再点击上面的“创建软装方案”。
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-serif">先添加一个房间</CardTitle>
            <CardDescription>
              这是整个 Home 的第一个操作入口。先建 Room，再上传照片做 AI 空间分析。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex min-h-56 flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-muted/40 px-6 text-center text-muted-foreground">
              <DoorOpen className="h-10 w-10" />
              <p>这个 Home 还没有 Room。先加一个客厅、卧室或其他空间，流程就能继续往下走。</p>
            </div>
            <Button className="h-12 w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              添加房间
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 Room</DialogTitle>
            <DialogDescription>
              先把空间建起来，接下来就能上传照片、做 AI 分析，再创建软装方案。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="room-name">Room 名称</Label>
              <Input
                id="room-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="例如：客厅"
              />
            </div>
            <div className="space-y-2">
              <Label>Room 类型</Label>
              <Select
                value={formState.roomType}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, roomType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="选择 Room 类型" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleCreateRoom} disabled={isSubmitting}>
              {isSubmitting ? "创建中..." : "创建 Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 0,
  }).format(value);
}

function getAnalysisState(room: RoomEntry) {
  if (room.spatial_analysis) {
    return {
      label: "已分析",
      className: "rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700",
    };
  }

  if (room.original_photo_url) {
    return {
      label: "待分析",
      className: "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700",
    };
  }

  return {
    label: "未上传照片",
    className: "rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground",
  };
}

function getRoomGuidance(room: RoomEntry) {
  if (!room.original_photo_url) {
    return "先上传房间照片，AI 才能开始识别空间。";
  }

  if (!room.spatial_analysis) {
    return "照片已上传，接下来让 AI 分析墙面和可摆放区域。";
  }

  if (room.furnishing_plans.length === 0) {
    return "分析已完成，现在可以创建第一个软装方案。";
  }

  return "继续进入软装清单，添加商品并生成效果图。";
}
