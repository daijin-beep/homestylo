"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function normalizePhoneInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function normalizeTokenInput(value: string) {
  return value.replace(/\D/g, "").slice(0, 6);
}

function getErrorMessage(message: string) {
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("invalid") || lowerMessage.includes("token")) {
    return "\u9a8c\u8bc1\u7801\u65e0\u6548\uff0c\u8bf7\u91cd\u65b0\u8f93\u5165\u3002";
  }

  if (lowerMessage.includes("network")) {
    return "\u7f51\u7edc\u5f02\u5e38\uff0c\u8bf7\u68c0\u67e5\u7f51\u7edc\u540e\u91cd\u8bd5\u3002";
  }

  return "\u8bf7\u6c42\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002";
}

export function LoginPageClient() {
  const router = useRouter();
  const [supabase] = useState(() => getSupabaseBrowserClient());

  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [countdown, setCountdown] = useState(0);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [redirectPath] = useState(() => {
    if (typeof window === "undefined") {
      return "/dashboard";
    }

    const params = new URLSearchParams(window.location.search);
    const rawPath = params.get("redirect") ?? "/dashboard";
    return rawPath.startsWith("/") ? rawPath : "/dashboard";
  });

  const isPhoneValid = phone.length === 11;
  const isTokenValid = token.length === 6;
  const normalizedPhone = isPhoneValid ? `+86${phone}` : "";

  useEffect(() => {
    if (countdown <= 0) {
      return;
    }

    const timer = window.setInterval(() => {
      setCountdown((current) => (current > 0 ? current - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [countdown]);

  const handleSendCode = async () => {
    if (!isPhoneValid) {
      toast.error("\u8bf7\u8f93\u5165 11 \u4f4d\u4e2d\u56fd\u5927\u9646\u624b\u673a\u53f7\u3002");
      return;
    }

    setIsSendingCode(true);
    const { error } = await supabase.auth.signInWithOtp({ phone: normalizedPhone });
    setIsSendingCode(false);

    if (error) {
      toast.error(getErrorMessage(error.message));
      return;
    }

    toast.success("\u9a8c\u8bc1\u7801\u5df2\u53d1\u9001\uff0c\u8bf7\u7559\u610f\u77ed\u4fe1\u3002");
    setCountdown(60);
  };

  const handleLogin = async () => {
    if (!isPhoneValid) {
      toast.error("\u8bf7\u5148\u8f93\u5165\u6b63\u786e\u624b\u673a\u53f7\u3002");
      return;
    }

    if (!isTokenValid) {
      toast.error("\u8bf7\u8f93\u5165 6 \u4f4d\u9a8c\u8bc1\u7801\u3002");
      return;
    }

    setIsSubmitting(true);
    const { error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token,
      type: "sms",
    });
    setIsSubmitting(false);

    if (error) {
      toast.error(getErrorMessage(error.message));
      return;
    }

    toast.success("\u767b\u5f55\u6210\u529f\uff0c\u6b63\u5728\u8df3\u8f6c\u3002");
    router.replace(redirectPath);
    router.refresh();
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <Card className="w-full max-w-sm border-border bg-card">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl font-serif text-foreground">
            {"\u624b\u673a\u53f7\u767b\u5f55"}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {"\u4e70\u5927\u5bb6\u5177\u524d\uff0c\u5148\u653e\u8fdb\u4f60\u5bb6\u770b\u770b"}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="phone">{"\u624b\u673a\u53f7\u7801"}</Label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                +86
              </span>
              <Input
                id="phone"
                type="tel"
                inputMode="numeric"
                placeholder="\u8bf7\u8f93\u5165 11 \u4f4d\u624b\u673a\u53f7"
                className="h-12 pl-14 text-base"
                value={phone}
                onChange={(event) => setPhone(normalizePhoneInput(event.target.value))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="token">{"\u9a8c\u8bc1\u7801"}</Label>
            <Input
              id="token"
              type="text"
              inputMode="numeric"
              placeholder="\u8bf7\u8f93\u5165 6 \u4f4d\u9a8c\u8bc1\u7801"
              className="h-12 text-base tracking-[0.25em]"
              value={token}
              onChange={(event) => setToken(normalizeTokenInput(event.target.value))}
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            className="h-12 w-full"
            onClick={handleSendCode}
            disabled={isSendingCode || countdown > 0}
          >
            {isSendingCode ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {"\u53d1\u9001\u4e2d..."}
              </>
            ) : countdown > 0 ? (
              `${countdown} \u79d2\u540e\u53ef\u91cd\u53d1`
            ) : (
              "\u83b7\u53d6\u9a8c\u8bc1\u7801"
            )}
          </Button>

          <Button
            type="button"
            className="h-12 w-full text-base"
            onClick={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {"\u767b\u5f55\u4e2d..."}
              </>
            ) : (
              "\u767b\u5f55"
            )}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
