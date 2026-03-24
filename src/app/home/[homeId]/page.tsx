"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

const HomeRoomsClient = dynamic(
  () =>
    import("@/components/home/HomeRoomsClient").then((mod) => ({
      default: mod.HomeRoomsClient,
    })),
  { ssr: false },
);

export default function HomePage() {
  const params = useParams<{ homeId: string }>();
  const homeId = Array.isArray(params.homeId) ? params.homeId[0] : params.homeId;

  if (!homeId) {
    return null;
  }

  return <HomeRoomsClient homeId={homeId} />;
}
