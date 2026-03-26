-- ============================================
-- V2 Phase 1: Spatial calibration fields
-- ============================================

-- rooms table extensions
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS depth_raw_url TEXT,
  ADD COLUMN IF NOT EXISTS focal_length_px NUMERIC,
  ADD COLUMN IF NOT EXISTS camera_calibration JSONB,
  ADD COLUMN IF NOT EXISTS calibration_source TEXT
    CHECK (calibration_source IN ('door', 'ceiling', 'user_wall', 'floorplan')),
  ADD COLUMN IF NOT EXISTS calibration_accuracy NUMERIC,
  ADD COLUMN IF NOT EXISTS anchor_detection JSONB;

-- furnishing_plan_items table extensions
ALTER TABLE public.furnishing_plan_items
  ADD COLUMN IF NOT EXISTS position_3d JSONB,
  ADD COLUMN IF NOT EXISTS position_pixel JSONB,
  ADD COLUMN IF NOT EXISTS rotation_y NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS product_description JSONB,
  ADD COLUMN IF NOT EXISTS extracted_image_url TEXT,
  ADD COLUMN IF NOT EXISTS candidate_image_urls JSONB;
