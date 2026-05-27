alter table public.recipes
  add column product_id uuid references public.items(id) on delete set null;
