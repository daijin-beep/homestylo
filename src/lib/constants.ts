import type { BudgetTier, ProductCategory, ProductRole, RoomType, StyleType } from "@/lib/types";

export const FLUX_PROMPTS: Record<StyleType, string> = {
  midcentury:
    "mid-century modern living room, walnut furniture, warm brown corduroy sofa, brass accent lamp, PH pendant light, warm natural lighting, 3000K tone, editorial interior photography, soft shadows",
  cream_french:
    "cream French style living room, soft white and beige palette, curved furniture silhouettes, ornate vintage chandelier, warm diffused natural light, plaster walls, herringbone floor, romantic elegant atmosphere",
  wabi_sabi:
    "wabi-sabi living room, raw plaster walls, imperfect textures, natural linen sofa, weathered elm wood furniture, dried pampas grass, handmade pottery, soft diffused light, zen minimalism, muted earth palette",
  song: "Chinese Song dynasty aesthetic living room, minimal rosewood furniture, ink wash painting, celadon vase, paper screen, natural light through rice paper window, scholarly atmosphere, restrained elegance",
  dopamine:
    "dopamine maximalist living room, bold colorful accents, pink pendant light, yellow mushroom lamp, Memphis style dining set, deep brown corduroy sofa, walnut TV cabinet, playful art prints, warm vibrant atmosphere",
};

export const STYLE_DEFINITIONS: Record<
  StyleType,
  {
    label: string;
    baseColor: string;
    accentColor: string;
    fluxKeywords: string[];
  }
> = {
  midcentury: {
    label: "\u4e2d\u53e4\u98ce",
    baseColor: "#F3E8D8",
    accentColor: "#8B5A37",
    fluxKeywords: ["walnut furniture", "corduroy sofa", "brass accent"],
  },
  cream_french: {
    label: "\u5976\u6cb9\u6cd5\u5f0f",
    baseColor: "#F7F3EC",
    accentColor: "#E07B3C",
    fluxKeywords: ["curved furniture", "soft white palette", "vintage chandelier"],
  },
  wabi_sabi: {
    label: "\u4f98\u5bc2\u98ce",
    baseColor: "#EFE8DE",
    accentColor: "#7A8A74",
    fluxKeywords: ["raw plaster walls", "natural linen sofa", "handmade pottery"],
  },
  song: {
    label: "\u5b8b\u5f0f\u7f8e\u5b66",
    baseColor: "#F1EFE7",
    accentColor: "#3E5C76",
    fluxKeywords: ["rosewood furniture", "ink wash painting", "celadon vase"],
  },
  dopamine: {
    label: "\u591a\u5df4\u80fa",
    baseColor: "#F6F1E7",
    accentColor: "#FF5C5C",
    fluxKeywords: ["bold colorful accents", "Memphis style", "playful art prints"],
  },
};

export const BUDGET_TIER_DEFINITIONS: Record<
  BudgetTier,
  {
    label: string;
    min: number;
    max: number | null;
  }
> = {
  economy: {
    label: "\u7ecf\u6d4e",
    min: 0,
    max: 20000,
  },
  quality: {
    label: "\u54c1\u8d28",
    min: 20000,
    max: 50000,
  },
  premium: {
    label: "\u9ad8\u7aef",
    min: 50000,
    max: null,
  },
  custom: {
    label: "\u81ea\u5b9a\u4e49",
    min: 0,
    max: null,
  },
};

export const PRODUCT_ROLE_CATEGORIES: Record<ProductRole, ProductCategory[]> = {
  primary: ["sofa", "bed", "dining_table", "tv_cabinet", "curtain"],
  secondary: ["coffee_table", "rug", "floor_lamp", "side_table"],
  accessory: ["painting", "pillow", "plant"],
};

export const PRODUCT_CATEGORY_DEFINITIONS: Record<
  ProductCategory,
  {
    label: string;
    role: ProductRole;
  }
> = {
  sofa: { label: "\u6c99\u53d1", role: "primary" },
  bed: { label: "\u5e8a", role: "primary" },
  dining_table: { label: "\u9910\u684c", role: "primary" },
  tv_cabinet: { label: "\u7535\u89c6\u67dc", role: "primary" },
  curtain: { label: "\u7a97\u5e18", role: "primary" },
  coffee_table: { label: "\u8336\u51e0", role: "secondary" },
  rug: { label: "\u5730\u6bef", role: "secondary" },
  floor_lamp: { label: "\u843d\u5730\u706f", role: "secondary" },
  side_table: { label: "\u8fb9\u51e0", role: "secondary" },
  painting: { label: "\u88c5\u9970\u753b", role: "accessory" },
  pillow: { label: "\u62b1\u6795", role: "accessory" },
  plant: { label: "\u7eff\u690d", role: "accessory" },
};

export const ROOM_TYPE_DEFINITIONS: Record<
  RoomType,
  {
    label: string;
  }
> = {
  living_room: { label: "\u5ba2\u5385" },
  bedroom: { label: "\u5367\u5ba4" },
  dining_room: { label: "\u9910\u5385" },
};
