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
