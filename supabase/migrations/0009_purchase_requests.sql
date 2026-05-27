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
