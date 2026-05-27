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
