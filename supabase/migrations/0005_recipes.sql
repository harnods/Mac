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
