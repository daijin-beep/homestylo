alter table public.shares
  add column if not exists watermark_level text not null default 'brand_bar';
