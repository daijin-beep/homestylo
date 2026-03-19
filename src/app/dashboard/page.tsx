import Link from "next/link";
import { BackLinkButton } from "@/components/BackLinkButton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 md:px-8">
      <BackLinkButton href="/" />

      <section className="space-y-2">
        <h1 className="text-3xl font-serif text-foreground">
          {"\u65b9\u6848\u5217\u8868"}
        </h1>
      </section>

      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-xl font-serif">
            {"\u6682\u65e0\u65b9\u6848"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex h-48 items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground">
            {"\u63d2\u56fe\u5360\u4f4d\u533a\u57df"}
          </div>
          <Button asChild className="h-12 w-full sm:w-auto">
            <Link href="/upload">
              {"\u5f00\u59cb\u4f60\u7684\u7b2c\u4e00\u4e2a\u65b9\u6848 \u2192"}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
