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
