import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function formatPrice(cents: number): string {
  const amountInYuan = Math.round(cents / 100);
  return `\u00A5${new Intl.NumberFormat("zh-CN").format(amountInYuan)}`;
}

export function formatDimension(mm: number): string {
  if (mm >= 1000) {
    return `${(mm / 1000).toFixed(1)}m`;
  }

  const cm = mm / 10;
  const formattedCm = Number.isInteger(cm) ? cm.toString() : cm.toFixed(1);
  return `${formattedCm}cm`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
