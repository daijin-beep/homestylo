"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
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
    return "\u7528\u6237";
  }

  const lastFour = user.phone.replace(/\D/g, "").slice(-4);
  return lastFour ? lastFour : "\u7528\u6237";
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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (pathname === "/generate/loading") {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-[#E5E5E5] bg-white">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 md:px-8">
        <Link
          href="/"
          className="font-serif text-[20px] font-bold tracking-tight text-[#8B5A37]"
        >
          HomeStylo
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/create"
            className="hidden h-9 items-center rounded-lg bg-[#8B5A37] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#754a2f] sm:inline-flex"
          >
            {"\u5f00\u59cb\u8bbe\u8ba1"}
          </Link>
          <Link
            href="/create"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-[#8B5A37] text-white sm:hidden"
            aria-label="\u5f00\u59cb\u8bbe\u8ba1"
          >
            <Sparkles className="h-4 w-4" />
          </Link>

          {!activeUser ? (
            <Link
              href="/login"
              className="px-2 text-sm font-medium text-foreground transition-colors hover:text-[#8B5A37]"
            >
              {"\u767b\u5f55"}
            </Link>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 min-w-9 items-center justify-center rounded-full border border-border bg-[#F5F0E9] px-2 text-xs font-semibold text-[#8B5A37]"
                  aria-label="\u7528\u6237\u83dc\u5355"
                >
                  {getUserBadge(activeUser)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-36">
                <DropdownMenuItem asChild>
                  <Link href="/dashboard">{"\u6211\u7684\u65b9\u6848"}</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={(event) => {
                    event.preventDefault();
                    void handleSignOut();
                  }}
                >
                  {"\u9000\u51fa\u767b\u5f55"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
