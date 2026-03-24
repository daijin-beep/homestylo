"use client";

import dynamic from "next/dynamic";

const HomeDashboardClient = dynamic(
  () =>
    import("@/components/home/HomeDashboardClient").then((mod) => ({
      default: mod.HomeDashboardClient,
    })),
  { ssr: false },
);

export default function DashboardPage() {
  return <HomeDashboardClient />;
}
