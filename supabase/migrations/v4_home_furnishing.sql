-- ============================================
-- V4.0 Migration: Home + Furnishing Plan model
-- ============================================

-- 1. HOMES
CREATE TABLE IF NOT EXISTS public.homes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Home',
  home_type TEXT NOT NULL DEFAULT 'new_build' CHECK (home_type IN ('new_build', 'renovation', 'occupied')),
  status TEXT NOT NULL DEFAULT 'configuring' CHECK (status IN ('configuring', 'mostly_done', 'maintaining')),
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.homes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own homes"
  ON public.homes FOR ALL
  USING (auth.uid() = user_id);

CREATE INDEX idx_homes_user_id ON public.homes(user_id);

-- 2. ROOMS (replaces the role of schemes as room containers)
CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  home_id UUID NOT NULL REFERENCES public.homes(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Living Room',
  room_type TEXT NOT NULL CHECK (room_type IN ('living_room', 'bedroom', 'dining_room', 'study', 'kitchen', 'bathroom', 'other')),
  original_photo_url TEXT,
  current_photo_url TEXT,
  floor_plan_url TEXT,
  spatial_analysis JSONB,
  depth_map_url TEXT,
  camera_params JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own rooms"
  ON public.rooms FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.homes
      WHERE homes.id = rooms.home_id
      AND homes.user_id = auth.uid()
    )
  );

CREATE INDEX idx_rooms_home_id ON public.rooms(home_id);

-- 3. FURNISHING_PLANS (the "Furnishing Cart")
CREATE TABLE IF NOT EXISTS public.furnishing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Plan A',
  total_budget NUMERIC,
  current_total NUMERIC NOT NULL DEFAULT 0,
  style_preference TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'browsing', 'partial_purchase', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.furnishing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own furnishing plans"
  ON public.furnishing_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.rooms
      JOIN public.homes ON homes.id = rooms.home_id
      WHERE rooms.id = furnishing_plans.room_id
      AND homes.user_id = auth.uid()
    )
  );

CREATE INDEX idx_furnishing_plans_room_id ON public.furnishing_plans(room_id);

-- 4. FURNISHING_PLAN_ITEMS (items in the cart)
CREATE TABLE IF NOT EXISTS public.furnishing_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.furnishing_plans(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'ai_recommended' CHECK (source IN ('ai_recommended', 'user_uploaded')),
  locked BOOLEAN NOT NULL DEFAULT false,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  custom_name TEXT,
  custom_image_url TEXT,
  custom_source_url TEXT,
  custom_width_mm INTEGER,
  custom_depth_mm INTEGER,
  custom_height_mm INTEGER,
  price NUMERIC,
  price_range_min NUMERIC,
  price_range_max NUMERIC,
  fit_status TEXT NOT NULL DEFAULT 'pending' CHECK (fit_status IN ('pending', 'confirmed', 'warning', 'blocked')),
  fit_message TEXT,
  status TEXT NOT NULL DEFAULT 'recommended' CHECK (status IN ('recommended', 'candidate', 'confirmed', 'purchased', 'abandoned')),
  purchased_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.furnishing_plan_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own furnishing plan items"
  ON public.furnishing_plan_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.furnishing_plans
      JOIN public.rooms ON rooms.id = furnishing_plans.room_id
      JOIN public.homes ON homes.id = rooms.home_id
      WHERE furnishing_plans.id = furnishing_plan_items.plan_id
      AND homes.user_id = auth.uid()
    )
  );

CREATE INDEX idx_furnishing_plan_items_plan_id ON public.furnishing_plan_items(plan_id);

-- 5. Link effect_images to furnishing_plans instead of schemes
ALTER TABLE public.effect_images
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES public.furnishing_plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_effect_images_plan_id ON public.effect_images(plan_id);
