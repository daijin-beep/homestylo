"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DoorOpen, ImageIcon, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { BackLinkButton } from "@/components/BackLinkButton";
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
import type { Home, Room } from "@/lib/types";

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

export function HomeRoomsClient({ homeId }: { homeId: string }) {
  const router = useRouter();
  const { currentHome, setHome, setRooms, addRoom, setLoading, isLoading } = useHomeStore(
    (state) => ({
      currentHome: state.currentHome,
      setHome: state.setHome,
      setRooms: state.setRooms,
      addRoom: state.addRoom,
      setLoading: state.setLoading,
      isLoading: state.isLoading,
    }),
  );
  const [roomEntries, setRoomEntries] = useState<RoomEntry[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState({
    name: "",
    roomType: "living_room",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;

    async function loadHome() {
      setLoading(true);

      try {
        const response = await fetch(`/api/home/${homeId}`, { cache: "no-store" });
        const payload = (await response.json()) as { success: boolean; data?: HomeResponse; error?: string };

        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "加载 Home 详情失败");
        }

        if (!ignore) {
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
        }
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

    void loadHome();

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
        ...current,
        {
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
          furnishing_plans: [],
        },
      ]);
      setDialogOpen(false);
      setFormState({ name: "", roomType: "living_room" });
      toast.success("Room 已创建");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建 Room 失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleOpenPlan(room: RoomEntry) {
    const existingPlan = room.furnishing_plans[0];

    if (existingPlan) {
      router.push(`/furnishing/${existingPlan.id}`);
      return;
    }

    setActiveRoomId(room.id);

    try {
      const response = await fetch("/api/furnishing/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: room.id }),
      });

      const payload = (await response.json()) as {
        success: boolean;
        data?: { id: string; name: string; total_budget: number | null; current_total: number; status: string };
        error?: string;
      };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || "创建 Furnishing Plan 失败");
      }

      setRoomEntries((current) =>
        current.map((entry) =>
          entry.id === room.id
            ? { ...entry, furnishing_plans: [payload.data!, ...entry.furnishing_plans] }
            : entry,
        ),
      );
      router.push(`/furnishing/${payload.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "创建 Furnishing Plan 失败");
    } finally {
      setActiveRoomId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <BackLinkButton href="/dashboard" />
        <Button className="h-11" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          添加 Room
        </Button>
      </div>

      <section className="space-y-2">
        <h1 className="text-3xl font-serif text-foreground">{currentHome?.name || "Home 详情"}</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          {currentHome?.address || "这个 Home 还没有地址信息"} · {roomCountLabel}
        </p>
      </section>

      {isLoading ? (
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            正在加载 Room...
          </CardContent>
        </Card>
      ) : roomEntries.length > 0 ? (
        <section className="grid gap-4 lg:grid-cols-2">
          {roomEntries.map((room) => {
            const thumbnail = room.current_photo_url || room.original_photo_url;
            const hasPlan = room.furnishing_plans.length > 0;

            return (
              <Card key={room.id} className="overflow-hidden border-border bg-card">
                <div className="relative aspect-[16/9] bg-muted/30">
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
                <CardHeader className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <CardTitle className="text-xl font-serif">{room.name}</CardTitle>
                      <CardDescription>{ROOM_TYPE_LABELS[room.room_type] || room.room_type}</CardDescription>
                    </div>
                    <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                      {room.furnishing_plans.length} 个计划
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                    {hasPlan ? (
                      <div className="space-y-1">
                        <p>默认计划：{room.furnishing_plans[0].name}</p>
                        <p>当前总价：{formatCurrency(room.furnishing_plans[0].current_total)}</p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <DoorOpen className="h-4 w-4" />
                        <span>还没有 Furnishing Plan</span>
                      </div>
                    )}
                  </div>
                  <Button
                    className="h-11 w-full"
                    disabled={activeRoomId === room.id}
                    onClick={() => void handleOpenPlan(room)}
                  >
                    <Sparkles className="h-4 w-4" />
                    {activeRoomId === room.id
                      ? "处理中..."
                      : hasPlan
                        ? "进入软装清单"
                        : "创建软装清单"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </section>
      ) : (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-serif">还没有 Room</CardTitle>
            <CardDescription>先添加一个 Room，再为它创建 Furnishing Plan。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex h-52 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/40 px-6 text-center text-muted-foreground">
              <DoorOpen className="h-10 w-10" />
              <p>这个 Home 还没有 Room，先加一个客厅、卧室或其他空间。</p>
            </div>
            <Button className="h-12 w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              添加 Room
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建 Room</DialogTitle>
            <DialogDescription>先把空间建起来，后面才能放进 Furnishing Plan。</DialogDescription>
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
