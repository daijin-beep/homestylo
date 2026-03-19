import type { Config } from "tailwindcss";

const config = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#8B5A37",
          foreground: "#FFFFFF",
        },
        background: "#F5F0E9",
        foreground: "#2B3A4A",
        accent: {
          DEFAULT: "#E07B3C",
          foreground: "#FFFFFF",
        },
        warning: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["var(--font-noto-sans-sc)", "sans-serif"],
        serif: ["var(--font-noto-serif-sc)", "serif"],
      },
    },
  },
} satisfies Config;

export default config;
