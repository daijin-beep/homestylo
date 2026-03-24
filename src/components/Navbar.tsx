"use client";

import Link from "next/link";
import { Home, Sparkles } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useAuth } from "@/components/AuthProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function getUserBadge(user: SupabaseUser | null) {
  if (!user?.phone) {
    return "用户";
  }

  const lastFour = user.phone.replace(/\D/g, "").slice(-4);
  return lastFour || "用户";
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [supabase] = useState(() => getSupabaseBrowserClient());
  const { user } = useAuth();
  const [activeUser, setActiveUser] = useState<SupabaseUser | null>(user);

  useEffect(() => {
    setActiveUser(user);
  }, [user]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setActiveUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  if (pathname === "/generate/loading") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 h-16 border-b border-[#e5d8c7] bg-white/92 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-7xl items-center justify-between px-4 md:px-8">
        <Link
          href="/"
          className="flex items-center gap-2 font-serif text-[22px] font-bold tracking-tight text-[#8B5A37]"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#f3e7d7] text-sm">
            H
          </span>
          <span>HomeStylo</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard"
            className="hidden items-center gap-2 px-3 text-sm font-medium text-foreground/80 transition-colors hover:text-[#8B5A37] md:inline-flex"
          >
            <Home className="h-4 w-4" />
            我的家
          </Link>
          <Link
            href="/pricing"
            className="hidden px-3 text-sm font-medium text-foreground/75 transition-colors hover:text-[#8B5A37] md:inline-flex"
          >
            套餐价格
          </Link>
          <Link
            href="/create"
            className="hidden h-9 items-center rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f] sm:inline-flex"
          >
            开始设计
          </Link>
          <Link
            href="/create"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#8B5A37] text-white sm:hidden"
            aria-label="开始设计"
          >
            <Sparkles className="h-4 w-4" />
          </Link>

          {!activeUser ? (
            <Link
              href="/login"
              className="px-2 text-sm font-medium text-foreground transition-colors hover:text-[#8B5A37]"
            >
              登录
            </Link>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border bg-[#F5F0E9] px-2 text-xs font-semibold text-[#8B5A37]"
                  aria-label="用户菜单"
                >
                  {getUserBadge(activeUser)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">我的家</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleSignOut();
                  }}
                >
                  退出登录
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
