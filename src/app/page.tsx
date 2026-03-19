import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-1 items-center px-4 py-8 md:px-8">
      <Card className="w-full border-border bg-card">
        <CardHeader className="space-y-2">
          <CardTitle className="text-3xl font-serif">
            {"HomeStylo"}
          </CardTitle>
          <p className="text-base text-muted-foreground">
            {"\u9996\u9875\u5360\u4f4d\u5185\u5bb9\u5df2\u5c31\u7eea\uff0c\u8bf7\u4ece\u767b\u5f55\u6216\u4ef7\u683c\u9875\u5f00\u59cb\u6d41\u7a0b\u3002"}
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-12">
            <Link href="/login">{"\u53bb\u767b\u5f55"}</Link>
          </Button>
          <Button asChild variant="secondary" className="h-12">
            <Link href="/pricing">{"\u67e5\u770b\u4ef7\u683c"}</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
