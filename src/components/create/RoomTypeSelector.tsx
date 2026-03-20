"use client";

import { BedDouble, Sofa, UtensilsCrossed } from "lucide-react";
import { motion } from "framer-motion";
import type { RoomType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface RoomTypeSelectorProps {
  value: RoomType | null;
  onChange: (value: RoomType) => void;
}

const ROOM_OPTIONS: Array<{
  value: RoomType;
  label: string;
  Icon: typeof Sofa;
}> = [
  { value: "living_room", label: "客厅", Icon: Sofa },
  { value: "bedroom", label: "卧室", Icon: BedDouble },
  { value: "dining_room", label: "餐厅", Icon: UtensilsCrossed },
];

export function RoomTypeSelector({ value, onChange }: RoomTypeSelectorProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-foreground">{"房间类型（必填）"}</h2>
        <div className="h-1 w-10 rounded-full bg-[#8B5A37]" />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {ROOM_OPTIONS.map(({ value: optionValue, label, Icon }) => {
          const isSelected = value === optionValue;

          return (
            <motion.button
              key={optionValue}
              type="button"
              whileTap={{ scale: 0.98 }}
              animate={{
                scale: isSelected ? 1.03 : 1,
                boxShadow: isSelected
                  ? "0 12px 24px rgba(139,90,55,0.18)"
                  : "0 2px 8px rgba(0,0,0,0.06)",
              }}
              onClick={() => onChange(optionValue)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-4 text-sm font-medium transition-colors",
                isSelected
                  ? "border-[#8B5A37] text-[#8B5A37]"
                  : "border-border text-foreground hover:border-[#8B5A37]/40",
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </motion.button>
          );
        })}
      </div>
    </section>
  );
}
