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
