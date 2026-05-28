-- =============================================================
-- Mac — full database bootstrap (schema + RLS + functions)
-- Run this once against a fresh Supabase project (SQL Editor
-- or psql) to reproduce the complete schema.
-- Generated from supabase/migrations + standalone migrations.
-- All statements are idempotent (safe to re-run).
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- migrations/0001_init.sql
-- ─────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────
-- migrations/0002_uncategorized.sql
-- ─────────────────────────────────────────────────────────────
-- Add is_default flag to categories and seed the Uncategorized category.
-- Run in Supabase SQL Editor after 0001_init.sql.

begin;

-- 1. Add is_default column
alter table public.categories
  add column if not exists is_default boolean not null default false;

-- 2. Only one default allowed
create unique index if not exists categories_one_default
  on public.categories (is_default)
  where is_default = true;

-- 3. Insert Uncategorized (skip if already exists)
insert into public.categories (name, is_default)
values ('Uncategorized', true)
on conflict (name) do update set is_default = true;

-- 4. Migrate existing items with null category_id to Uncategorized
update public.items
set category_id = (select id from public.categories where is_default = true)
where category_id is null;

-- 5. Trigger: when any non-default category is deleted,
--    reassign its items to the default category before the delete.
create or replace function public.reassign_items_on_category_delete()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  default_id uuid;
begin
  if old.is_default then
    raise exception 'Cannot delete the default category.';
  end if;
  select id into default_id from public.categories where is_default = true;
  if default_id is not null then
    update public.items set category_id = default_id where category_id = old.id;
  end if;
  return old;
end $$;

drop trigger if exists before_category_delete on public.categories;
create trigger before_category_delete
before delete on public.categories
for each row execute function public.reassign_items_on_category_delete();

commit;


-- ─────────────────────────────────────────────────────────────
-- migrations/0003_updated_by.sql
-- ─────────────────────────────────────────────────────────────
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


-- ─────────────────────────────────────────────────────────────
-- migrations/0004_on_hand_reserved.sql
-- ─────────────────────────────────────────────────────────────
-- Rename quantity → on_hand, add reserved column.
-- Run in Supabase SQL Editor after 0003_updated_by.sql.

begin;

alter table public.items rename column quantity to on_hand;

alter table public.items
  add column reserved numeric(14, 4) not null default 0 check (reserved >= 0);

-- Ensure on_hand check still applies after rename
alter table public.items drop constraint if exists items_quantity_check;
alter table public.items add constraint items_on_hand_check check (on_hand >= 0);

commit;


-- ─────────────────────────────────────────────────────────────
-- migrations/0005_recipes.sql
-- ─────────────────────────────────────────────────────────────
create table public.recipes (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  updated_by  uuid        references public.profiles(id) on delete set null
);

create table public.recipe_items (
  id          uuid           primary key default gen_random_uuid(),
  recipe_id   uuid           not null references public.recipes(id) on delete cascade,
  item_id     uuid           not null references public.items(id) on delete cascade,
  quantity    numeric(14, 4) not null check (quantity > 0),
  unit        unit_code      not null,
  created_at  timestamptz    not null default now()
);

alter table public.recipes     enable row level security;
alter table public.recipe_items enable row level security;

create policy "auth read recipes"
  on public.recipes for select to authenticated using (true);

create policy "auth read recipe_items"
  on public.recipe_items for select to authenticated using (true);

create policy "admin manage recipes"
  on public.recipes for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "admin manage recipe_items"
  on public.recipe_items for all to authenticated
  using (is_admin()) with check (is_admin());

create trigger recipes_updated_at
  before update on public.recipes
  for each row execute function touch_updated_at();


-- ─────────────────────────────────────────────────────────────
-- migrations/0006_item_types.sql
-- ─────────────────────────────────────────────────────────────
create type item_type as enum ('ingredient', 'supply', 'product', 'prep_item');
create type category_type as enum ('ingredient', 'supply', 'product');

alter table public.items
  add column type item_type not null default 'ingredient';

alter table public.categories
  add column type category_type not null default 'ingredient';

-- Replace global name uniqueness with per-type uniqueness
alter table public.categories drop constraint if exists categories_name_key;
create unique index if not exists categories_name_type_unique
  on public.categories (name, type);

drop index if exists categories_is_default_unique;
drop index if exists categories_one_default;
create unique index categories_is_default_unique
  on public.categories (type) where (is_default = true);

insert into public.categories (name, is_default, type)
values
  ('Uncategorized', true, 'supply'),
  ('Uncategorized', true, 'product');

create or replace function before_category_delete()
returns trigger language plpgsql security definer as $$
declare
  default_id uuid;
begin
  if old.is_default then
    raise exception 'Cannot delete the default category';
  end if;
  select id into default_id
  from public.categories
  where is_default = true and type = old.type
  limit 1;
  if default_id is not null then
    update public.items
    set category_id = default_id, updated_at = now()
    where category_id = old.id;
  end if;
  return old;
end;
$$;


-- ─────────────────────────────────────────────────────────────
-- migrations/0007_recipe_product.sql
-- ─────────────────────────────────────────────────────────────
alter table public.recipes
  add column product_id uuid references public.items(id) on delete set null;


-- ─────────────────────────────────────────────────────────────
-- migrations/0008_units_table.sql
-- ─────────────────────────────────────────────────────────────
create table public.units (
  code       text        primary key,
  is_system  boolean     not null default false,
  created_at timestamptz not null default now()
);

insert into public.units (code, is_system) values
  ('pcs', true),
  ('g',   true),
  ('kg',  true),
  ('ml',  true),
  ('l',   true);

-- Migrate items.unit from enum to text FK
alter table public.items
  alter column unit type text using unit::text;

alter table public.items
  add constraint items_unit_fk foreign key (unit) references public.units(code);

-- Migrate recipe_items.unit from enum to text FK
alter table public.recipe_items
  alter column unit type text using unit::text;

alter table public.recipe_items
  add constraint recipe_items_unit_fk foreign key (unit) references public.units(code);

-- Drop the old enum (no longer needed)
drop type if exists public.unit_code;

-- RLS
alter table public.units enable row level security;

create policy "units read all" on public.units
  for select to authenticated using (true);

create policy "units admin insert" on public.units
  for insert to authenticated with check (public.is_admin() and not is_system);

create policy "units admin delete" on public.units
  for delete to authenticated using (public.is_admin() and not is_system);


-- ─────────────────────────────────────────────────────────────
-- migrations/0009_purchase_requests.sql
-- ─────────────────────────────────────────────────────────────
create type purchase_request_status as enum ('pending', 'approved', 'rejected');

create table public.purchase_requests (
  id          uuid                     primary key default gen_random_uuid(),
  status      purchase_request_status  not null default 'pending',
  note        text,
  created_by  uuid                     references public.profiles(id) on delete set null,
  reviewed_by uuid                     references public.profiles(id) on delete set null,
  created_at  timestamptz              not null default now(),
  updated_at  timestamptz              not null default now(),
  updated_by  uuid                     references public.profiles(id) on delete set null
);

create table public.purchase_request_items (
  id          uuid           primary key default gen_random_uuid(),
  request_id  uuid           not null references public.purchase_requests(id) on delete cascade,
  item_id     uuid           not null references public.items(id) on delete cascade,
  qty         numeric(14, 4) not null check (qty > 0),
  unit        text           not null references public.units(code),
  created_at  timestamptz    not null default now()
);

create trigger purchase_requests_updated_at
  before update on public.purchase_requests
  for each row execute function touch_updated_at();

alter table public.purchase_requests      enable row level security;
alter table public.purchase_request_items enable row level security;

-- All authenticated users can read
create policy "auth read purchase_requests"
  on public.purchase_requests for select to authenticated using (true);

create policy "auth read purchase_request_items"
  on public.purchase_request_items for select to authenticated using (true);

-- Any authenticated user can create a request
create policy "auth insert purchase_requests"
  on public.purchase_requests for insert to authenticated with check (auth.uid() = created_by);

create policy "auth insert purchase_request_items"
  on public.purchase_request_items for insert to authenticated
  with check (
    exists (
      select 1 from public.purchase_requests
      where id = request_id and created_by = auth.uid() and status = 'pending'
    )
  );

-- Only admin can update (approve/reject)
create policy "admin update purchase_requests"
  on public.purchase_requests for update to authenticated
  using (is_admin()) with check (is_admin());

-- Creator can delete their own pending request; admin can delete any
create policy "owner delete purchase_requests"
  on public.purchase_requests for delete to authenticated
  using (created_by = auth.uid() or is_admin());


-- ─────────────────────────────────────────────────────────────
-- migrations/0010_purchases.sql
-- ─────────────────────────────────────────────────────────────
create table public.purchases (
  id                  uuid        primary key default gen_random_uuid(),
  purchase_request_id uuid        references public.purchase_requests(id) on delete set null,
  note                text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  updated_by          uuid        references public.profiles(id) on delete set null
);

create table public.purchase_items (
  id            uuid           primary key default gen_random_uuid(),
  purchase_id   uuid           not null references public.purchases(id) on delete cascade,
  item_id       uuid           not null references public.items(id) on delete cascade,
  qty_requested numeric(14, 4),
  qty_purchased numeric(14, 4) not null check (qty_purchased > 0),
  unit          text           not null references public.units(code),
  created_at    timestamptz    not null default now()
);

create trigger purchases_updated_at
  before update on public.purchases
  for each row execute function touch_updated_at();

alter table public.purchases      enable row level security;
alter table public.purchase_items enable row level security;

create policy "auth read purchases"
  on public.purchases for select to authenticated using (true);

create policy "auth read purchase_items"
  on public.purchase_items for select to authenticated using (true);

create policy "admin manage purchases"
  on public.purchases for all to authenticated
  using (is_admin()) with check (is_admin());

create policy "admin manage purchase_items"
  on public.purchase_items for all to authenticated
  using (is_admin()) with check (is_admin());


-- ─────────────────────────────────────────────────────────────
-- migrations/0011_purchase_cost.sql
-- ─────────────────────────────────────────────────────────────
alter table public.purchases
  add column transaction_date date not null default current_date;

alter table public.purchase_items
  add column requested_unit text references public.units(code),
  add column cost_per_unit  numeric(14, 2),
  add column cost_total     numeric(14, 2),
  add column row_note       text;

alter table public.items
  add column last_purchase_cost numeric(14, 2);


-- ─────────────────────────────────────────────────────────────
-- migrations/0012_stock_ledger.sql
-- ─────────────────────────────────────────────────────────────
-- Stock ledger: records every movement that changes on_hand or reserved.
-- qty_delta is stored in the item's base unit (positive = in, negative = out).

create table public.stock_ledger (
  id             uuid           primary key default gen_random_uuid(),
  item_id        uuid           not null references public.items(id) on delete cascade,
  type           text           not null check (type in ('purchase', 'pr_approved', 'pr_rejected', 'adjustment')),
  ref_id         uuid,          -- purchase id or purchase_request id
  qty_delta      numeric(14, 4) not null,  -- change to on_hand, in item's base unit
  on_hand_after  numeric(14, 4) not null,
  reserved_after numeric(14, 4) not null,
  note           text,
  created_at     timestamptz    not null default now(),
  created_by     uuid           references public.profiles(id) on delete set null
);

create index stock_ledger_item_id_idx on public.stock_ledger (item_id, created_at desc);

alter table public.stock_ledger enable row level security;

create policy "auth read stock_ledger"
  on public.stock_ledger for select to authenticated using (true);

create policy "admin insert stock_ledger"
  on public.stock_ledger for insert to authenticated with check (is_admin());


-- ─────────────────────────────────────────────────────────────
-- migrations/0013_avg_purchase_cost.sql
-- ─────────────────────────────────────────────────────────────
alter table public.items add column avg_purchase_cost numeric(14, 2);


-- ─────────────────────────────────────────────────────────────
-- migrations/0014_pr_reviewed_at.sql
-- ─────────────────────────────────────────────────────────────
alter table public.purchase_requests add column reviewed_at timestamptz;


-- ─────────────────────────────────────────────────────────────
-- migrations/0015_purchase_multi_pr.sql
-- ─────────────────────────────────────────────────────────────
-- Many-to-many: purchases ↔ purchase_requests
create table public.purchase_purchase_requests (
  purchase_id         uuid not null references public.purchases(id) on delete cascade,
  purchase_request_id uuid not null references public.purchase_requests(id) on delete cascade,
  primary key (purchase_id, purchase_request_id)
);

-- Migrate existing single-PR links
insert into public.purchase_purchase_requests (purchase_id, purchase_request_id)
select id, purchase_request_id
from public.purchases
where purchase_request_id is not null;

-- Drop old FK column
alter table public.purchases drop column if exists purchase_request_id;


-- ─────────────────────────────────────────────────────────────
-- migrations/0016_purchase_multi_pr_rls.sql
-- ─────────────────────────────────────────────────────────────
alter table public.purchase_purchase_requests enable row level security;

create policy "auth read purchase_purchase_requests"
  on public.purchase_purchase_requests for select to authenticated using (true);

create policy "admin manage purchase_purchase_requests"
  on public.purchase_purchase_requests for all to authenticated
  using (is_admin()) with check (is_admin());


-- ─────────────────────────────────────────────────────────────
-- recipe-yield-migration.sql
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS yield_qty numeric NOT NULL DEFAULT 1 CHECK (yield_qty > 0);


-- ─────────────────────────────────────────────────────────────
-- recipe-unit-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Add unit column to recipes (for WIP yield unit)
ALTER TABLE public.recipes
  ADD COLUMN IF NOT EXISTS unit TEXT;

-- Seed "portion" unit if not exists
INSERT INTO public.units (code, is_system)
  VALUES ('portion', false)
  ON CONFLICT (code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- recipe-weight-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Add weight_per_pcs and weight_unit columns to recipes
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS weight_per_pcs NUMERIC,
  ADD COLUMN IF NOT EXISTS weight_unit TEXT;


-- ─────────────────────────────────────────────────────────────
-- product-set-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Add product_kind to items
ALTER TABLE public.items
  ADD COLUMN IF NOT EXISTS product_kind TEXT NOT NULL DEFAULT 'ala_carte'
    CHECK (product_kind IN ('ala_carte', 'set'));

-- Set composition: which products are inside a set product
CREATE TABLE IF NOT EXISTS public.product_set_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id     UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.items(id),
  UNIQUE (set_id, product_id)
);

ALTER TABLE public.product_set_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read product_set_items"
  ON public.product_set_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert product_set_items"
  ON public.product_set_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can delete product_set_items"
  ON public.product_set_items FOR DELETE TO authenticated USING (true);

-- Ensure "set" unit exists
INSERT INTO public.units (code, is_system)
  VALUES ('set', false)
  ON CONFLICT (code) DO NOTHING;


-- ─────────────────────────────────────────────────────────────
-- product-set-qty-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Add qty column to product_set_items (default 1 for existing rows)
ALTER TABLE public.product_set_items
  ADD COLUMN IF NOT EXISTS qty NUMERIC NOT NULL DEFAULT 1 CHECK (qty > 0);


-- ─────────────────────────────────────────────────────────────
-- item-status-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Add status column to items (for product draft/active workflow)
ALTER TABLE items
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'draft'));


-- ─────────────────────────────────────────────────────────────
-- item-sellable-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Add is_sellable flag to items (for prep items that can be sold à la carte / in sets)
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_sellable BOOLEAN NOT NULL DEFAULT FALSE;


-- ─────────────────────────────────────────────────────────────
-- prep-orders-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Prep Orders Migration

CREATE TABLE IF NOT EXISTS public.prep_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id),
  product_id uuid REFERENCES public.items(id),
  qty_to_prep numeric NOT NULL CHECK (qty_to_prep > 0),
  unit text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  notes text CHECK (char_length(notes) <= 500),
  planned_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prep_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_order_id uuid NOT NULL REFERENCES public.prep_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  qty_needed numeric NOT NULL,
  unit text NOT NULL,
  UNIQUE (prep_order_id, item_id)
);

-- Extend stock_ledger type check to include prep order types
ALTER TABLE public.stock_ledger
  DROP CONSTRAINT IF EXISTS stock_ledger_type_check;

ALTER TABLE public.stock_ledger
  ADD CONSTRAINT stock_ledger_type_check
  CHECK (type IN (
    'purchase',
    'pr_approved',
    'pr_rejected',
    'adjustment_in',
    'adjustment_out',
    'count_adjustment',
    'reservation',
    'reservation_release',
    'prep_consumption',
    'prep_output'
  ));

-- RLS for prep_orders
ALTER TABLE public.prep_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on prep_orders"
  ON public.prep_orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Staff select on prep_orders"
  ON public.prep_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
    )
  );

-- RLS for prep_order_items
ALTER TABLE public.prep_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on prep_order_items"
  ON public.prep_order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Staff select on prep_order_items"
  ON public.prep_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
    )
  );


-- ─────────────────────────────────────────────────────────────
-- prep-orders-batch-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Add batch_count to prep_orders
ALTER TABLE public.prep_orders
  ADD COLUMN IF NOT EXISTS batch_count numeric NOT NULL DEFAULT 1 CHECK (batch_count > 0);


-- ─────────────────────────────────────────────────────────────
-- prep-orders-workflow-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Add target_qty for planned yield, allow qty_to_prep to be null (set on completion)
ALTER TABLE prep_orders
  ADD COLUMN IF NOT EXISTS target_qty NUMERIC;

-- Allow qty_to_prep to be null for pending orders
ALTER TABLE prep_orders
  ALTER COLUMN qty_to_prep DROP NOT NULL;

-- Backfill target_qty from existing completed orders
UPDATE prep_orders SET target_qty = qty_to_prep WHERE target_qty IS NULL;

-- Expand status constraint to include 'pending'
ALTER TABLE prep_orders DROP CONSTRAINT IF EXISTS prep_orders_status_check;
ALTER TABLE prep_orders ADD CONSTRAINT prep_orders_status_check
  CHECK (status IN ('pending', 'planned', 'completed', 'cancelled'));

-- Set default status to pending
ALTER TABLE prep_orders ALTER COLUMN status SET DEFAULT 'pending';

-- Add yield variance reason
ALTER TABLE prep_orders
  ADD COLUMN IF NOT EXISTS yield_variance_reason TEXT;


-- ─────────────────────────────────────────────────────────────
-- sales-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Sales entries (nightly closing recap)
CREATE TABLE IF NOT EXISTS public.sales_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date  DATE NOT NULL,
  notes       TEXT,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Line items per entry
CREATE TABLE IF NOT EXISTS public.sales_entry_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id    UUID NOT NULL REFERENCES public.sales_entries(id) ON DELETE CASCADE,
  product_id  UUID NOT NULL REFERENCES public.items(id),
  qty         NUMERIC NOT NULL CHECK (qty > 0),
  unit        TEXT NOT NULL
);

-- Add sales_consumption to stock_ledger type constraint
ALTER TABLE public.stock_ledger
  DROP CONSTRAINT IF EXISTS stock_ledger_type_check;

ALTER TABLE public.stock_ledger
  ADD CONSTRAINT stock_ledger_type_check CHECK (type IN (
    'purchase', 'pr_approved', 'pr_rejected',
    'adjustment_in', 'adjustment_out', 'count_adjustment',
    'reservation', 'reservation_release',
    'prep_consumption', 'prep_output',
    'sales_consumption'
  ));

-- RLS
ALTER TABLE public.sales_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_entry_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read sales_entries"
  ON public.sales_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can read sales_entry_items"
  ON public.sales_entry_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert sales_entries"
  ON public.sales_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can insert sales_entry_items"
  ON public.sales_entry_items FOR INSERT TO authenticated WITH CHECK (true);


-- ─────────────────────────────────────────────────────────────
-- stock-adjustments-migration.sql
-- ─────────────────────────────────────────────────────────────
-- Stock Adjustments Migration
-- Manual stock adjustments and stock count (stockopname)

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES public.items(id),
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  qty numeric NOT NULL CHECK (qty > 0),
  unit text NOT NULL,
  reason text CHECK (char_length(reason) <= 300),
  adjustment_date date NOT NULL DEFAULT CURRENT_DATE,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_date date NOT NULL DEFAULT CURRENT_DATE,
  note text CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed')),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  count_id uuid NOT NULL REFERENCES public.stock_counts(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  qty_system numeric NOT NULL,
  qty_counted numeric,
  unit text NOT NULL,
  note text CHECK (char_length(note) <= 300),
  UNIQUE (count_id, item_id)
);

-- RLS for stock_adjustments
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on stock_adjustments"
  ON public.stock_adjustments
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Staff select on stock_adjustments"
  ON public.stock_adjustments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
    )
  );

-- RLS for stock_counts
ALTER TABLE public.stock_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on stock_counts"
  ON public.stock_counts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Staff select on stock_counts"
  ON public.stock_counts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
    )
  );

-- RLS for stock_count_items
ALTER TABLE public.stock_count_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on stock_count_items"
  ON public.stock_count_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Staff select on stock_count_items"
  ON public.stock_count_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
    )
  );


-- ─────────────────────────────────────────────────────────────
-- clear-data-function.sql
-- ─────────────────────────────────────────────────────────────
-- RPC function to clear all operational data, keeping profiles and system units.
-- Admin-only: verified inside the function.
CREATE OR REPLACE FUNCTION public.clear_all_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  -- Verify caller is admin
  SELECT role INTO v_role FROM profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Truncate all operational tables in dependency order (CASCADE handles any remaining refs)
  TRUNCATE TABLE
    stock_ledger,
    sales_entry_items,
    sales_entries,
    stock_adjustments,
    stock_count_items,
    stock_counts,
    purchase_items,
    purchase_request_items,
    purchase_requests,
    purchases,
    prep_order_items,
    prep_orders,
    recipe_items,
    product_set_items,
    recipes,
    items,
    categories
  RESTART IDENTITY CASCADE;

  -- Remove user-created units only
  DELETE FROM units WHERE is_system = false;
END;
$$;

-- Revoke public execute, only authenticated users (checked inside)
REVOKE ALL ON FUNCTION public.clear_all_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clear_all_data() TO authenticated;

