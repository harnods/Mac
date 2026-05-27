-- Add updated_by to items and updated_at/updated_by to categories.
-- Run in Supabase SQL Editor after 0002_uncategorized.sql.

begin;

-- 1. items: add updated_by
alter table public.items
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- backfill
update public.items set updated_by = created_by where updated_by is null;

-- 2. categories: add updated_at + updated_by
alter table public.categories
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists updated_by uuid references public.profiles(id) on delete set null;

-- backfill
update public.categories
  set updated_at = created_at, updated_by = created_by
where updated_by is null;

-- 3. trigger: keep categories.updated_at current
create or replace function public.touch_categories_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists categories_touch on public.categories;
create trigger categories_touch
before update on public.categories
for each row execute function public.touch_categories_updated_at();

-- 4. RLS: allow any authenticated user to read profiles
--    (needed so staff can see updater names via table joins)
drop policy if exists "profiles read authenticated" on public.profiles;
create policy "profiles read authenticated" on public.profiles
  for select using (auth.role() = 'authenticated');

commit;
