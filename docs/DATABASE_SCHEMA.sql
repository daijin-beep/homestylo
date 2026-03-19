-- HomeStylo Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- This creates all 7 tables with Row Level Security

-- ============================================
-- 1. USERS
-- ============================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone TEXT,
  nickname TEXT,
  avatar_url TEXT,
  plan_type TEXT NOT NULL DEFAULT 'free' CHECK (plan_type IN ('free', 'single', 'room', 'dual')),
  generation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.users FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, phone)
  VALUES (NEW.id, NEW.phone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 2. SCHEMES
-- ============================================
CREATE TABLE public.schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  room_type TEXT NOT NULL CHECK (room_type IN ('living_room', 'bedroom', 'dining_room')),
  style TEXT CHECK (style IN ('midcentury', 'song', 'cream_french', 'wabi_sabi', 'dopamine')),
  budget_min INTEGER,
  budget_max INTEGER,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'analyzing', 'importing', 'generating', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own schemes"
  ON public.schemes FOR ALL
  USING (auth.uid() = user_id);

-- ============================================
-- 3. ROOM_ANALYSIS
-- ============================================
CREATE TABLE public.room_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  photo_url TEXT NOT NULL,
  floor_plan_url TEXT,
  structure_json JSONB,
  constraints_json JSONB,
  user_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.room_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own room analysis"
  ON public.room_analysis FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = room_analysis.scheme_id
      AND schemes.user_id = auth.uid()
    )
  );

-- ============================================
-- 4. EFFECT_IMAGES
-- ============================================
CREATE TABLE public.effect_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  hotspot_map JSONB,
  generation_params JSONB,
  generation_status TEXT NOT NULL DEFAULT 'pending' CHECK (generation_status IN ('pending', 'depth', 'flux', 'sam', 'fill', 'hotspot', 'done', 'failed')),
  error_message TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.effect_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own effect images"
  ON public.effect_images FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = effect_images.scheme_id
      AND schemes.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. PRODUCTS (public read, admin write)
-- ============================================
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('sofa', 'coffee_table', 'tv_cabinet', 'bed', 'dining_table', 'curtain', 'rug', 'floor_lamp', 'painting', 'pillow', 'side_table', 'plant')),
  style TEXT NOT NULL CHECK (style IN ('midcentury', 'song', 'cream_french', 'wabi_sabi', 'dopamine', 'universal')),
  price_min INTEGER NOT NULL,
  price_max INTEGER NOT NULL,
  width_mm INTEGER NOT NULL,
  depth_mm INTEGER NOT NULL,
  height_mm INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  source_url TEXT,
  brand TEXT,
  tags TEXT[] DEFAULT '{}',
  is_hero BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Everyone can read products
CREATE POLICY "Products are publicly readable"
  ON public.products FOR SELECT
  USING (true);

-- Only service role can insert/update/delete (admin operations use service key)

-- ============================================
-- 6. SCHEME_PRODUCTS
-- ============================================
CREATE TABLE public.scheme_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  role TEXT NOT NULL CHECK (role IN ('primary', 'secondary', 'accessory')),
  category TEXT NOT NULL,
  is_user_imported BOOLEAN NOT NULL DEFAULT false,
  import_source TEXT CHECK (import_source IN ('screenshot', 'hero_sku', 'link', 'recommendation')),
  custom_name TEXT,
  custom_image_url TEXT,
  custom_width_mm INTEGER,
  custom_depth_mm INTEGER,
  custom_height_mm INTEGER,
  custom_price INTEGER,
  status TEXT NOT NULL DEFAULT 'recommended' CHECK (status IN ('recommended', 'candidate', 'confirmed', 'purchased', 'abandoned')),
  actual_price INTEGER,
  purchased_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scheme_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can CRUD own scheme products"
  ON public.scheme_products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = scheme_products.scheme_id
      AND schemes.user_id = auth.uid()
    )
  );

-- ============================================
-- 7. SHARES
-- ============================================
CREATE TABLE public.shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('single', 'list', 'compare')),
  image_url TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shares ENABLE ROW LEVEL SECURITY;

-- Owner can manage their shares
CREATE POLICY "Users can CRUD own shares"
  ON public.shares FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = shares.scheme_id
      AND schemes.user_id = auth.uid()
    )
  );

-- Anyone can view a share (for public share pages)
CREATE POLICY "Shares are publicly viewable"
  ON public.shares FOR SELECT
  USING (true);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_schemes_user_id ON public.schemes(user_id);
CREATE INDEX idx_room_analysis_scheme_id ON public.room_analysis(scheme_id);
CREATE INDEX idx_effect_images_scheme_id ON public.effect_images(scheme_id);
CREATE INDEX idx_products_category_style ON public.products(category, style);
CREATE INDEX idx_scheme_products_scheme_id ON public.scheme_products(scheme_id);
CREATE INDEX idx_shares_scheme_id ON public.shares(scheme_id);

-- ============================================
-- STORAGE BUCKETS
-- ============================================
-- Run these separately in Supabase Dashboard → Storage → Create bucket
-- Bucket: room-photos (public: false)
-- Bucket: product-images (public: true)

-- Storage policies for room-photos:
-- Users can upload to their own folder: INSERT with check (bucket_id = 'room-photos' AND auth.uid()::text = (storage.foldername(name))[1])
-- Users can read their own photos: SELECT with check (bucket_id = 'room-photos' AND auth.uid()::text = (storage.foldername(name))[1])
