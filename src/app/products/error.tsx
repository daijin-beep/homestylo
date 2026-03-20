"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ProductsErrorProps {
  error: Error;
  reset: () => void;
}

export default function ProductsError({ error, reset }: ProductsErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[60vh] w-full max-w-6xl flex-1 flex-col items-center justify-center gap-4 px-4 py-8 text-center">
      <h1 className="text-2xl font-serif text-foreground">
        {"\u5546\u54c1\u5217\u8868\u52a0\u8f7d\u5931\u8d25"}
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        {"\u8bf7\u7a0d\u540e\u91cd\u8bd5\uff0c\u6216\u68c0\u67e5 Supabase \u6570\u636e\u5e93\u8fde\u63a5\u72b6\u6001\u3002"}
      </p>
      <Button onClick={reset}>{"\u91cd\u8bd5"}</Button>
    </main>
  );
}
