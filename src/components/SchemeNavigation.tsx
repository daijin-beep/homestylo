import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SchemeStep } from "@/lib/store/schemeStore";

const STEP_CONFIG: { key: SchemeStep; label: string }[] = [
  { key: "upload", label: "\u4e0a\u4f20" },
  { key: "analyze", label: "\u5206\u6790" },
  { key: "import", label: "\u5bfc\u5165" },
  { key: "style", label: "\u98ce\u683c" },
  { key: "generate", label: "\u751f\u6210" },
  { key: "result", label: "\u7ed3\u679c" },
  { key: "compare", label: "\u5bf9\u6bd4" },
  { key: "accounting", label: "\u8bb0\u8d26" },
];

interface SchemeNavigationProps {
  currentStep: SchemeStep;
  schemeId?: string;
}

function getStepHref(step: SchemeStep, schemeId?: string) {
  if (step === "upload") {
    return "/upload";
  }

  if (!schemeId) {
    return null;
  }

  return `/${step}/${schemeId}`;
}

export function SchemeNavigation({ currentStep, schemeId }: SchemeNavigationProps) {
  const currentIndex = STEP_CONFIG.findIndex((step) => step.key === currentStep);

  return (
    <nav
      className="w-full overflow-x-auto pb-1"
      aria-label="\u65b9\u6848\u6d41\u7a0b\u5bfc\u822a"
    >
      <ol className="flex min-w-max items-center gap-2">
        {STEP_CONFIG.map((step, index) => {
          const href = getStepHref(step.key, schemeId);
          const isCurrent = index === currentIndex;
          const isCompleted = index < currentIndex;

          return (
            <li key={step.key} className="flex items-center gap-2">
              {href ? (
                <Link
                  href={href}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground hover:border-primary/60",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isCurrent
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </Link>
              ) : (
                <span
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm",
                    isCurrent
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "inline-flex h-5 w-5 items-center justify-center rounded-full text-xs",
                      isCurrent
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isCompleted ? <Check className="h-3.5 w-3.5" /> : index + 1}
                  </span>
                  <span>{step.label}</span>
                </span>
              )}

              {index < STEP_CONFIG.length - 1 ? (
                <span className="text-muted-foreground" aria-hidden>
                  →
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
