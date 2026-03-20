"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useCandidateCount } from "@/hooks/useCandidateCount";

const navItems = [
  {
    label: "\u5546\u54c1",
    href: "/products",
  },
  {
    label: "\u6211\u7684\u5019\u9009",
    href: "/candidates",
  },
];

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { count } = useCandidateCount();

  return (
    <header className="sticky top-0 z-50 h-14 border-b border-border bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-between px-4 md:px-8">
        <Link href="/" className="text-[20px] font-bold tracking-tight text-foreground">
          HomeStylo
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="relative text-sm font-medium text-foreground transition-colors hover:text-primary"
            >
              {item.label}
              {item.href === "/candidates" && count > 0 ? (
                <span className="absolute -right-4 -top-2 inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                  {count}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => setIsMobileMenuOpen((current) => !current)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-border text-foreground md:hidden"
          aria-label={isMobileMenuOpen ? "\u5173\u95ed\u83dc\u5355" : "\u6253\u5f00\u83dc\u5355"}
          aria-expanded={isMobileMenuOpen}
        >
          {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "border-b border-border bg-white px-4 pb-4 md:hidden",
          isMobileMenuOpen ? "block" : "hidden",
        )}
      >
        <nav className="flex flex-col gap-3 pt-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setIsMobileMenuOpen(false)}
              className="flex items-center justify-between rounded-md px-2 py-2 text-sm font-medium text-foreground hover:bg-muted"
            >
              <span>{item.label}</span>
              {item.href === "/candidates" && count > 0 ? (
                <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">
                  {count}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
