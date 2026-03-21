alter table public.users
  add column if not exists plan_type text not null default 'free',
  add column if not exists plan_room_limit integer not null default 1,
  add column if not exists generation_count integer not null default 0,
  add column if not exists replacement_count integer not null default 0,
  add column if not exists replacement_daily_count integer not null default 0,
  add column if not exists replacement_daily_reset_at timestamptz;
