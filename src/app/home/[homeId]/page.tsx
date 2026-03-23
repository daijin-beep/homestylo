import { HomeRoomsClient } from "@/components/home/HomeRoomsClient";

export default async function HomePage({
  params,
}: {
  params: Promise<{ homeId: string }>;
}) {
  const { homeId } = await params;

  return <HomeRoomsClient homeId={homeId} />;
}
