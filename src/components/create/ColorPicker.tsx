"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  selected: string[];
  onToggle: (hex: string) => void;
}

const COLORS = [
  { label: "暖白", value: "#FFF8F0" },
  { label: "米棕", value: "#C8956C" },
  { label: "焦糖", value: "#8B5A37" },
  { label: "橄榄绿", value: "#6B8E6B" },
  { label: "深蓝", value: "#2B3A4A" },
  { label: "灰粉", value: "#D4A5A5" },
  { label: "明黄", value: "#FDCB6E" },
  { label: "酒红", value: "#C0392B" },
];

export function ColorPicker({ selected, onToggle }: ColorPickerProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-foreground">{"你偏好的色调"}</h2>
        <div className="h-1 w-10 rounded-full bg-[#8B5A37]" />
      </div>

      <div className="flex flex-wrap gap-3">
        {COLORS.map((item) => {
          const isSelected = selected.includes(item.value);
          const disabled = !isSelected && selected.length >= 3;

          return (
            <motion.button
              key={item.value}
              type="button"
              disabled={disabled}
              whileTap={{ scale: 0.95 }}
              animate={{ scale: isSelected ? 1.08 : 1 }}
              className={cn(
                "group flex flex-col items-center gap-1 text-xs text-muted-foreground",
                disabled ? "cursor-not-allowed opacity-50" : "",
              )}
              onClick={() => onToggle(item.value)}
            >
              <span
                className={cn(
                  "h-9 w-9 rounded-full border transition-all md:h-10 md:w-10",
                  isSelected ? "border-4 border-[#8B5A37]" : "border border-border",
                )}
                style={{ backgroundColor: item.value }}
              />
              <span>{item.label}</span>
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{"可多选，最多 3 个。"}</p>
    </section>
  );
}
