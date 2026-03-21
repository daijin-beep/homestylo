alter table public.scheme_products
  add column if not exists actual_price numeric,
  add column if not exists purchased_at timestamptz;
