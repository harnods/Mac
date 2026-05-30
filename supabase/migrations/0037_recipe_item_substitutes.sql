create table public.recipe_item_substitutes (
  id             uuid        primary key default gen_random_uuid(),
  recipe_item_id uuid        not null references public.recipe_items(id) on delete cascade,
  item_id        uuid        not null references public.items(id)        on delete cascade,
  created_at     timestamptz not null default now(),
  unique (recipe_item_id, item_id)
);

alter table public.recipe_item_substitutes enable row level security;

create policy "recipe_item_substitutes read all" on public.recipe_item_substitutes
  for select to authenticated using (true);

create policy "recipe_item_substitutes admin write" on public.recipe_item_substitutes
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
