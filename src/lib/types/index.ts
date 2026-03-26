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
export type GenerationStatus =
  | "pending"
  | "depth"
  | "flux"
  | "sam"
  | "fill"
  | "hotspot"
  | "classifying"
  | "analyzing"
  | "preparing"
  | "generating"
  | "placing"
  | "refining"
  | "done"
  | "failed";
export type ProductImportSource = "screenshot" | "hero_sku" | "link" | "recommendation";
export type ProductStatus = "recommended" | "candidate" | "confirmed" | "purchased" | "abandoned";
export type ShareType = "effect_image" | "shopping_list" | "compare";
export type PlanType = "free" | "trial" | "serious" | "full" | "creator";

export interface User {
  id: string;
  phone: string | null;
  nickname: string | null;
  avatar_url: string | null;
  plan_type: PlanType;
  plan_room_limit: number;
  generation_count: number;
  replacement_count: number;
  replacement_daily_count: number;
  replacement_daily_reset_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Scheme {
  id: string;
  user_id: string;
  room_type: RoomType;
  style: StyleType | null;
  aesthetic_preferences: {
    style: string | null;
    moodboards: string[];
    colors: string[];
    reference_photo_urls: string[];
  } | null;
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
  plan_id?: string | null;
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
  watermark_level: string | null;
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

// ============================================
// V4.0 Types - Home + Furnishing Plan model
// ============================================

export type HomeType = "new_build" | "renovation" | "occupied";
export type HomeStatus = "configuring" | "mostly_done" | "maintaining";
export type RoomTypeV4 =
  | "living_room"
  | "bedroom"
  | "dining_room"
  | "study"
  | "kitchen"
  | "bathroom"
  | "other";
export type FurnishingPlanStatus = "draft" | "browsing" | "partial_purchase" | "completed";
export type ItemSource = "ai_recommended" | "user_uploaded";
export type FitStatus = "pending" | "confirmed" | "warning" | "blocked";
export type ItemStatus = "recommended" | "candidate" | "confirmed" | "purchased" | "abandoned";

export interface Home {
  id: string;
  user_id: string;
  name: string;
  home_type: HomeType;
  status: HomeStatus;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface Room {
  id: string;
  home_id: string;
  name: string;
  room_type: RoomTypeV4;
  original_photo_url: string | null;
  current_photo_url: string | null;
  floor_plan_url: string | null;
  spatial_analysis: SpatialAnalysis | null;
  depth_map_url: string | null;
  camera_params: CameraParams | null;
  depth_raw_url?: string | null;
  focal_length_px?: number | null;
  camera_calibration?: CameraCalibrationData | null;
  calibration_source?: CalibrationSource | null;
  calibration_accuracy?: number | null;
  anchor_detection?: AnchorDetectionResult | null;
  created_at: string;
  updated_at: string;
}

export interface SpatialAnalysis {
  walls: WallInfo[];
  floor_material: string | null;
  wall_color: string | null;
  lighting_direction: string | null;
  shooting_direction?: string | null;
  camera_view?: CameraView | null;
  available_spaces: AvailableSpace[];
  existing_furniture: ExistingFurniture[];
  confidence: number;
}

export interface CameraView {
  horizontal_angle: number;
  vertical_angle: number;
  direction: "left" | "right" | "center";
}

export interface AvailableSpace {
  id: string;
  label: string;
  width_mm: number;
  depth_mm: number;
  position: { x: number; y: number };
}

export interface ExistingFurniture {
  id: string;
  category: string;
  estimated_width_mm: number;
  estimated_depth_mm: number;
  position: { x: number; y: number };
}

export interface CameraParams {
  focal_length: number;
  principal_point: { x: number; y: number };
  rotation: number[];
  translation: number[];
}

export interface FurnishingPlan {
  id: string;
  room_id: string;
  name: string;
  total_budget: number | null;
  current_total: number;
  style_preference: string | null;
  status: FurnishingPlanStatus;
  created_at: string;
  updated_at: string;
}

export interface FurnishingPlanItem {
  id: string;
  plan_id: string;
  category: string;
  source: ItemSource;
  locked: boolean;
  product_id: string | null;
  custom_name: string | null;
  custom_image_url: string | null;
  custom_source_url: string | null;
  custom_width_mm: number | null;
  custom_depth_mm: number | null;
  custom_height_mm: number | null;
  price: number | null;
  price_range_min: number | null;
  price_range_max: number | null;
  fit_status: FitStatus;
  fit_message: string | null;
  status: ItemStatus;
  purchased_at: string | null;
  sort_order: number;
  position_3d?: Vec3mm | null;
  position_pixel?: FurniturePixelPosition | null;
  rotation_y?: number | null;
  product_description?: Record<string, unknown> | null;
  extracted_image_url?: string | null;
  candidate_image_urls?: string[] | null;
  created_at: string;
}

// Budget allocation result from AI
export interface BudgetAllocation {
  category: string;
  weight: number;
  allocated_amount: number;
  price_range: { min: number; max: number };
}

// ============================================
// V2.0 Types - Spatial calibration + Route F
// ============================================

export type AccuracyLevel = "L0" | "L1" | "L2" | "L3";
export type CalibrationSource = "door" | "ceiling" | "user_wall" | "floorplan";

export interface Vec2px {
  x: number;
  y: number;
}

export interface Vec3mm {
  x: number;
  y: number;
  z: number;
}

export interface SemanticAnchor {
  type: "door" | "ceiling_height" | "floor_tile" | "window" | "baseboard";
  pixelBounds: { topLeft: Vec2px; bottomRight: Vec2px };
  knownSizeMm: number;
  measureDirection: "vertical" | "horizontal";
  confidence: number;
}

export interface AnchorDetectionResult {
  anchors: SemanticAnchor[];
  bestAnchor: SemanticAnchor | null;
  roomFeatures: {
    wallColor: string | null;
    floorMaterial: string | null;
    lightingDirection: string | null;
    existingFurniture: ExistingFurniture[];
    shootingDirection: string | null;
  };
}

export interface CameraCalibrationData {
  K: number[][];
  scaleFactor: number;
  focalLengthPx: number;
  imageWidth: number;
  imageHeight: number;
  calibrationSource: CalibrationSource;
  estimatedAccuracy: number;
  fovYDeg: number;
}

export interface FurniturePixelPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FurnitureBBox3D {
  center: Vec3mm;
  width: number;
  depth: number;
  height: number;
  rotationY: number;
}

export interface ProjectionResult {
  maskBuffer: Buffer;
  boundingRect: FurniturePixelPosition;
  wallWidthPercent: number;
  isClipped: boolean;
}
