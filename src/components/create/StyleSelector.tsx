"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface StyleSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
}

const STYLE_OPTIONS = [
  { id: "midcentury", label: "中古风", color: "#8B5A37" },
  { id: "dopamine", label: "多巴胺", color: "#E84393" },
  { id: "cream_french", label: "奶油法式", color: "#FFEAA7" },
  { id: "song", label: "宋式美学", color: "#636E72" },
  { id: "wabi_sabi", label: "侘寂", color: "#B2BEC3" },
];

export function StyleSelector({ value, onChange }: StyleSelectorProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-foreground">
          {"风格偏好（建议选择）"}
        </h2>
        <div className="h-1 w-10 rounded-full bg-[#8B5A37]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {STYLE_OPTIONS.map((item) => {
          const isSelected = value === item.id;

          return (
            <motion.button
              key={item.id}
              type="button"
              whileTap={{ scale: 0.98 }}
              animate={{
                scale: isSelected ? 1.03 : 1,
                boxShadow: isSelected
                  ? "0 12px 24px rgba(139,90,55,0.18)"
                  : "0 2px 8px rgba(0,0,0,0.06)",
              }}
              onClick={() => onChange(isSelected ? null : item.id)}
              className={cn(
                "rounded-xl border bg-white px-3 py-3 text-left transition-colors",
                isSelected
                  ? "border-[#8B5A37] ring-2 ring-[#8B5A37]/20"
                  : "border-border hover:border-[#8B5A37]/40",
              )}
            >
              <div
                className={cn(
                  "h-10 w-full rounded-lg transition-transform",
                  isSelected ? "scale-[1.03]" : "scale-100",
                )}
                style={{ backgroundColor: item.color }}
              />
              <p className="mt-2 text-sm font-medium text-foreground">{item.label}</p>
            </motion.button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{"可不选，AI会自动判断风格。"}</p>
    </section>
  );
}
