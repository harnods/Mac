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
