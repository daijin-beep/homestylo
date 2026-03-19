import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BackLinkButtonProps {
  href: string;
}

export function BackLinkButton({ href }: BackLinkButtonProps) {
  return (
    <Button asChild variant="outline" className="h-11">
      <Link href={href}>
        <ArrowLeft className="h-4 w-4" />
        {"\u8fd4\u56de"}
      </Link>
    </Button>
  );
}
