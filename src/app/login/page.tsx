import type { Metadata } from "next";
import { LoginPageClient } from "@/components/auth/LoginPageClient";

export const metadata: Metadata = {
  title: "登录",
  description: "登录 HomeStylo，继续你的家居方案创建、替换与分享流程。",
};

export default function LoginPage() {
  return <LoginPageClient />;
}
