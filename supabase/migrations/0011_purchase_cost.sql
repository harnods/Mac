alter table public.purchases
  add column transaction_date date not null default current_date;

alter table public.purchase_items
  add column requested_unit text references public.units(code),
  add column cost_per_unit  numeric(14, 2),
  add column cost_total     numeric(14, 2),
  add column row_note       text;

alter table public.items
  add column last_purchase_cost numeric(14, 2);
