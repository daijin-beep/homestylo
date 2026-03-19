export type RoomType = "living_room" | "bedroom" | "dining_room";
export type StyleType = "midcentury" | "song" | "cream_french" | "wabi_sabi" | "dopamine";
export type BudgetTier = "economy" | "quality" | "premium" | "custom";
export type ProductCategory =
  | "sofa"
  | "coffee_table"
  | "tv_cabinet"
  | "bed"
  | "dining_table"
  | "curtain"
  | "rug"
  | "floor_lamp"
  | "painting"
  | "pillow"
  | "side_table"
  | "plant";
export type SchemeStatus = "draft" | "analyzing" | "importing" | "generating" | "completed";
export type ProductRole = "primary" | "secondary" | "accessory";
export type GenerationStatus = "pending" | "depth" | "flux" | "sam" | "fill" | "hotspot" | "done" | "failed";
export type ProductImportSource = "screenshot" | "hero_sku" | "link" | "recommendation";
export type ProductStatus = "recommended" | "candidate" | "confirmed" | "purchased" | "abandoned";
export type ShareType = "single" | "list" | "compare";
export type PlanType = "free" | "single" | "room" | "dual";

export interface User {
  id: string;
  phone: string | null;
  nickname: string | null;
  avatar_url: string | null;
  plan_type: PlanType;
  generation_count: number;
  created_at: string;
  updated_at: string;
}

export interface Scheme {
  id: string;
  user_id: string;
  room_type: RoomType;
  style: StyleType | null;
  budget_min: number | null;
  budget_max: number | null;
  status: SchemeStatus;
  created_at: string;
  updated_at: string;
}

export interface RoomAnalysis {
  id: string;
  scheme_id: string;
  photo_url: string;
  floor_plan_url: string | null;
  structure_json: SpaceStructure | null;
  constraints_json: FurnitureConstraints | null;
  user_confirmed: boolean;
  created_at: string;
}

export interface EffectImage {
  id: string;
  scheme_id: string;
  image_url: string;
  hotspot_map: Hotspot[] | null;
  generation_params: Record<string, unknown> | null;
  generation_status: GenerationStatus;
  error_message: string | null;
  version: number;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  style: StyleType | "universal";
  price_min: number;
  price_max: number;
  width_mm: number;
  depth_mm: number;
  height_mm: number;
  image_url: string;
  source_url: string | null;
  brand: string | null;
  tags: string[];
  is_hero: boolean;
  created_at: string;
}

export interface SchemeProduct {
  id: string;
  scheme_id: string;
  product_id: string | null;
  role: ProductRole;
  category: string;
  is_user_imported: boolean;
  import_source: ProductImportSource | null;
  custom_name: string | null;
  custom_image_url: string | null;
  custom_width_mm: number | null;
  custom_depth_mm: number | null;
  custom_height_mm: number | null;
  custom_price: number | null;
  status: ProductStatus;
  actual_price: number | null;
  purchased_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface Share {
  id: string;
  scheme_id: string;
  share_type: ShareType;
  image_url: string | null;
  view_count: number;
  created_at: string;
}

export interface SpaceStructure {
  walls: WallInfo[];
  shooting_direction: string;
  confidence: number;
}

export interface WallInfo {
  id: string;
  type: "solid_wall" | "window" | "door" | "opening";
  estimated_width_mm: number;
  label?: string;
}

export interface FurnitureConstraints {
  sofa_wall_width_mm: number;
  tv_wall_width_mm: number;
  room_depth_mm: number | null;
  max_sofa_width_mm: number;
  max_tv_cabinet_width_mm: number;
}

export interface Hotspot {
  product_id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ValidationResult {
  valid: boolean;
  risks: RiskItem[];
  metrics: {
    remaining_gap_mm: number | null;
    passage_width_mm: number | null;
    wall_ratio_percent: number | null;
  };
}

export interface RiskItem {
  type: "block" | "warning" | "info";
  message: string;
  detail: string;
}
