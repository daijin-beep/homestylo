create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id),
  plan_type text not null,
  amount numeric not null,
  status text not null default 'pending',
  payment_note text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Users can view own orders"
on public.orders
for select
using (auth.uid() = user_id);
