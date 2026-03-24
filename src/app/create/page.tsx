import type { Metadata } from "next";
import { CreatePageLoader } from "@/components/create/CreatePageLoader";

export const metadata: Metadata = {
  title: "开始设计",
  description: "上传房间照片，选择风格偏好，让 HomeStylo 帮你先看效果再下单。",
};

export default function CreatePage() {
  return <CreatePageLoader />;
}
