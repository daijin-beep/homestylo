"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HousePlus, MapPin, Plus, Sofa } from "lucide-react";
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
import type { Home } from "@/lib/types";

type HomeSummary = Home & {
  rooms: Array<{
    id: string;
    name: string;
    room_type: string;
    current_photo_url: string | null;
  }>;
};

const copy = {
  zh: {
    title: "我的家",
    subtitle: "从 Home 开始组织你的空间和软装清单。",
    createHome: "创建 Home",
    emptyTitle: "还没有 Home",
    emptyDescription: "先创建一个 Home，再往里面添加房间和软装清单。",
    name: "Home 名称",
    address: "地址",
    homeType: "Home 类型",
    newBuild: "新房",
    renovation: "翻新",
    occupied: "已入住",
    cancel: "取消",
    save: "创建并进入",
    open: "查看房间",
    rooms: "房间",
    createTitle: "创建新的 Home",
    createDescription: "先创建 Home，后续就在里面添加 Room 和 Furnishing Plan。",
    unnamedAddress: "未填写地址",
    loadFailed: "加载 Home 列表失败",
    createFailed: "创建 Home 失败",
    creating: "创建中...",
  },
  en: {
    title: "Homes",
  },
} as const;

const HOME_TYPE_OPTIONS = [
  { value: "new_build", label: copy.zh.newBuild },
  { value: "renovation", label: copy.zh.renovation },
  { value: "occupied", label: copy.zh.occupied },
] as const;

const HOME_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  HOME_TYPE_OPTIONS.map((option) => [option.value, option.label]),
);

export function HomeDashboardClient() {
  const t = copy.zh;
  const router = useRouter();
  const { homes, setHomes, addHome, setLoading, isLoading } = useHomeStore((state) => ({
    homes: state.homes,
    setHomes: state.setHomes,
    addHome: state.addHome,
    setLoading: state.setLoading,
    isLoading: state.isLoading,
  }));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState({
    name: "",
    address: "",
    homeType: "new_build",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadHomes() {
      setLoading(true);

      try {
        const response = await fetch("/api/home", { cache: "no-store" });
        const payload = (await response.json()) as { success: boolean; data?: HomeSummary[]; error?: string };

        if (!response.ok || !payload.success) {
          throw new Error(payload.error || t.loadFailed);
        }

        if (!ignore) {
          setHomes(
            (payload.data || []).map((home) => ({
              id: home.id,
              user_id: home.user_id,
              name: home.name,
              home_type: home.home_type,
              status: home.status,
              address: home.address,
              created_at: home.created_at,
              updated_at: home.updated_at,
            })),
          );
        }
      } catch (error) {
        if (!ignore) {
          toast.error(error instanceof Error ? error.message : t.loadFailed);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadHomes();

    return () => {
      ignore = true;
    };
  }, [setHomes, setLoading, t.loadFailed]);

  async function handleCreateHome() {
    if (!formState.name.trim()) {
      toast.error("请先填写 Home 名称");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/home", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formState.name.trim(),
          address: formState.address.trim() || null,
          home_type: formState.homeType,
        }),
      });

      const payload = (await response.json()) as { success: boolean; data?: Home; error?: string };

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error || t.createFailed);
      }

      addHome(payload.data);
      setDialogOpen(false);
      setFormState({ name: "", address: "", homeType: "new_build" });
      router.push(`/home/${payload.data.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.createFailed);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <div className="flex items-center justify-between gap-3">
        <BackLinkButton href="/" />
        <Button className="h-11" onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          {t.createHome}
        </Button>
      </div>

      <section className="space-y-2">
        <h1 className="text-3xl font-serif text-foreground">{t.title}</h1>
        <p className="text-sm text-muted-foreground md:text-base">{t.subtitle}</p>
      </section>

      {isLoading ? (
        <Card className="border-border bg-card">
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground">
            正在加载 Home...
          </CardContent>
        </Card>
      ) : homes.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {homes.map((home) => (
            <Card key={home.id} className="border-border bg-card">
              <CardHeader className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-xl font-serif">{home.name}</CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {home.address || t.unnamedAddress}
                    </CardDescription>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {HOME_TYPE_LABELS[home.home_type] || home.home_type}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-dashed border-border bg-muted/40 p-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Sofa className="h-4 w-4" />
                    <span>{home.status}</span>
                  </div>
                </div>
                <Button asChild className="h-11 w-full">
                  <Link href={`/home/${home.id}`}>{t.open}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>
      ) : (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-xl font-serif">{t.emptyTitle}</CardTitle>
            <CardDescription>{t.emptyDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex h-52 flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border bg-muted/40 px-6 text-center text-muted-foreground">
              <HousePlus className="h-10 w-10" />
              <p>创建第一个 Home 后，就可以开始添加 Room 和软装清单。</p>
            </div>
            <Button className="h-12 w-full sm:w-auto" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              {t.createHome}
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.createTitle}</DialogTitle>
            <DialogDescription>{t.createDescription}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="home-name">{t.name}</Label>
              <Input
                id="home-name"
                value={formState.name}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, name: event.target.value }))
                }
                placeholder="例如：虹桥的新家"
              />
            </div>
            <div className="space-y-2">
              <Label>{t.homeType}</Label>
              <Select
                value={formState.homeType}
                onValueChange={(value) =>
                  setFormState((current) => ({ ...current, homeType: value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.homeType} />
                </SelectTrigger>
                <SelectContent>
                  {HOME_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="home-address">{t.address}</Label>
              <Input
                id="home-address"
                value={formState.address}
                onChange={(event) =>
                  setFormState((current) => ({ ...current, address: event.target.value }))
                }
                placeholder="选填，例如：上海市闵行区"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t.cancel}
            </Button>
            <Button onClick={handleCreateHome} disabled={isSubmitting}>
              {isSubmitting ? t.creating : t.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
