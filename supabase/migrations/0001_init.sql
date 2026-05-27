-- Machitori: drop existing public schema objects and create fresh inventory schema.
-- Run this in the Supabase SQL Editor (project: vfctwnempmasikoeetcw).

begin;

-- 1) Drop all existing tables in public (CASCADE removes dependent FKs/views).
do $$
declare r record;
begin
  for r in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('drop table if exists public.%I cascade', r.tablename);
  end loop;

  for r in
    select typname from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
  loop
    execute format('drop type if exists public.%I cascade', r.typname);
  end loop;
end $$;

-- 2) Enums
create type public.user_role as enum ('admin', 'staff');
create type public.unit_code as enum ('pcs', 'g', 'kg', 'ml', 'l');

-- 3) Profiles (linked 1:1 with auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'staff',
  created_at timestamptz not null default now()
);

-- 4) Categories
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- 5) Items
create table public.items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category_id uuid references public.categories(id) on delete set null,
  unit public.unit_code not null,
  quantity numeric(14, 4) not null default 0 check (quantity >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index items_name_idx on public.items (name);
create index items_category_idx on public.items (category_id);

-- 6) Trigger to keep updated_at fresh
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

create trigger items_touch
before update on public.items
for each row execute function public.touch_updated_at();

-- 7) Auto-create profile when a new auth user is created.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data->>'role')::public.user_role, 'staff')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 8) Helper: is_admin()
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- 9) RLS
alter table public.profiles  enable row level security;
alter table public.categories enable row level security;
alter table public.items     enable row level security;

-- profiles: user can read own; admins can read all & update.
create policy "profiles self select" on public.profiles
  for select using (auth.uid() = id or public.is_admin());

create policy "profiles admin update" on public.profiles
  for update using (public.is_admin());

-- categories: any authenticated user can read; only admin can write.
create policy "categories read all" on public.categories
  for select using (auth.role() = 'authenticated');

create policy "categories admin insert" on public.categories
  for insert with check (public.is_admin());

create policy "categories admin update" on public.categories
  for update using (public.is_admin());

create policy "categories admin delete" on public.categories
  for delete using (public.is_admin());

-- items: any authenticated user can read; admin can write fully; staff can update quantity only (enforced at app layer).
create policy "items read all" on public.items
  for select using (auth.role() = 'authenticated');

create policy "items admin insert" on public.items
  for insert with check (public.is_admin());

create policy "items admin update" on public.items
  for update using (public.is_admin());

create policy "items staff update qty" on public.items
  for update using (auth.role() = 'authenticated');

create policy "items admin delete" on public.items
  for delete using (public.is_admin());

commit;
