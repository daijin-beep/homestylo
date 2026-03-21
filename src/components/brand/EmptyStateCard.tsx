import { cn } from "@/lib/utils";

interface EmptyStateCardProps {
  title: string;
  description: string;
  eyebrow?: string;
  className?: string;
}

export function EmptyStateCard({
  title,
  description,
  eyebrow = "HomeStylo",
  className,
}: EmptyStateCardProps) {
  return (
    <div
      className={cn(
        "rounded-[24px] border border-dashed border-[#d9c7b1] bg-[linear-gradient(180deg,#fffdf9_0%,#f8f1e6_100%)] px-6 py-10 text-center",
        className,
      )}
    >
      <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-[#f3e7d7]">
        <div className="relative h-10 w-10">
          <span className="absolute inset-0 rounded-full border-2 border-[#8B5A37]/20" />
          <span className="absolute left-2 top-2 h-6 w-6 rounded-full bg-[#8B5A37]" />
        </div>
      </div>
      <p className="text-xs uppercase tracking-[0.25em] text-[#8B5A37]/70">{eyebrow}</p>
      <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
