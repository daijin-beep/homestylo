"use client";

import Image from "next/image";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface MoodboardSelectorProps {
  selected: string[];
  onToggle: (id: string) => void;
}

const MOODBOARD_IDS = [
  "mood_1",
  "mood_2",
  "mood_3",
  "mood_4",
  "mood_5",
  "mood_6",
  "mood_7",
  "mood_8",
];

export function MoodboardSelector({ selected, onToggle }: MoodboardSelectorProps) {
  return (
    <section className="space-y-3">
      <div className="space-y-1">
        <h2 className="text-base font-bold text-foreground">{"选择你喜欢的感觉"}</h2>
        <div className="h-1 w-10 rounded-full bg-[#8B5A37]" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {MOODBOARD_IDS.map((id, index) => {
          const isSelected = selected.includes(id);
          const disabled = !isSelected && selected.length >= 3;

          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onToggle(id)}
              className={cn(
                "group relative aspect-[8/5] overflow-hidden rounded-xl border transition-all",
                isSelected
                  ? "border-[#8B5A37] shadow-md"
                  : "border-border hover:border-[#8B5A37]/50",
                disabled ? "cursor-not-allowed opacity-55" : "",
              )}
            >
              <Image
                src={`/images/moodboard/${id}.webp`}
                alt={id}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 50vw, 240px"
                loading={index < 2 ? "eager" : "lazy"}
              />
              <div
                className={cn(
                  "absolute inset-0 transition-colors",
                  isSelected ? "bg-black/35" : "bg-black/5 group-hover:bg-black/20",
                )}
              />
              {isSelected ? (
                <span className="absolute right-2 top-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#8B5A37] text-white">
                  <Check className="h-4 w-4" />
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">{"可多选，最多 3 张。"}</p>
    </section>
  );
}
