create extension if not exists pgcrypto;

create table if not exists public.styles (
  id text primary key,
  name text not null,
  description text,
  cover_image_url text not null,
  created_at timestamptz not null default now()
);

alter table public.styles enable row level security;

drop policy if exists "Styles are publicly readable" on public.styles;
create policy "Styles are publicly readable"
  on public.styles
  for select
  using (true);

alter table if exists public.products
  add column if not exists price numeric,
  add column if not exists dimensions text,
  add column if not exists description text;

alter table if exists public.products
  drop constraint if exists products_category_check;

alter table if exists public.products
  add constraint products_category_check check (
    category in (
      'sofa',
      'coffee_table',
      'tv_cabinet',
      'bed',
      'dining_table',
      'curtain',
      'rug',
      'floor_lamp',
      'painting',
      'pillow',
      'side_table',
      'plant',
      'dining_set',
      'lighting',
      'art',
      'lamp',
      'decor'
    )
  );
