"use client";

import dynamic from "next/dynamic";

const CreatePageClient = dynamic(
  () =>
    import("@/components/create/CreatePageClient").then((mod) => ({
      default: mod.CreatePageClient,
    })),
  { ssr: false },
);

export function CreatePageLoader() {
  return <CreatePageClient />;
}
