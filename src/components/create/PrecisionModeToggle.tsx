"use client";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface PrecisionDimensions {
  sofaWallWidth: number | null;
  roomDepth: number | null;
  ceilingHeight: number | null;
}

interface PrecisionModeToggleProps {
  mode: "simple" | "precision";
  dimensions: PrecisionDimensions;
  onModeChange: (mode: "simple" | "precision") => void;
  onDimensionsChange: (next: PrecisionDimensions) => void;
}

function toNumberOrNull(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function PrecisionModeToggle({
  mode,
  dimensions,
  onModeChange,
  onDimensionsChange,
}: PrecisionModeToggleProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-foreground">{"精度模式"}</h2>
        <div className="h-1 w-10 rounded-full bg-[#8B5A37]" />
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-[#f5f0e9] p-1">
        <button
          type="button"
          onClick={() => onModeChange("simple")}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            mode === "simple"
              ? "bg-white text-[#8B5A37] shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {"简易模式"}
        </button>
        <button
          type="button"
          onClick={() => onModeChange("precision")}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            mode === "precision"
              ? "bg-white text-[#8B5A37] shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {"高精度模式"}
        </button>
      </div>

      {mode === "simple" ? (
        <p className="rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          {"AI将根据照片自动估算空间尺寸"}
        </p>
      ) : (
        <div className="space-y-3 rounded-xl border border-border bg-white p-4">
          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">
              {"沙发墙净宽（mm）"}
            </span>
            <Input
              inputMode="numeric"
              placeholder="例如：3600"
              value={dimensions.sofaWallWidth ?? ""}
              onChange={(event) =>
                onDimensionsChange({
                  ...dimensions,
                  sofaWallWidth: toNumberOrNull(event.target.value),
                })
              }
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">
              {"房间进深（mm，可选）"}
            </span>
            <Input
              inputMode="numeric"
              placeholder="例如：4500"
              value={dimensions.roomDepth ?? ""}
              onChange={(event) =>
                onDimensionsChange({
                  ...dimensions,
                  roomDepth: toNumberOrNull(event.target.value),
                })
              }
            />
          </label>

          <label className="space-y-1">
            <span className="text-sm font-medium text-foreground">
              {"层高（mm，可选）"}
            </span>
            <Input
              inputMode="numeric"
              placeholder="例如：2800"
              value={dimensions.ceilingHeight ?? ""}
              onChange={(event) =>
                onDimensionsChange({
                  ...dimensions,
                  ceilingHeight: toNumberOrNull(event.target.value),
                })
              }
            />
          </label>

          <p className="text-xs text-muted-foreground">
            {"精确尺寸可以让效果图更准确，避免家具过大或过小。"}
          </p>
        </div>
      )}
    </section>
  );
}
