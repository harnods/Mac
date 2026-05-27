alter table public.purchase_purchase_requests enable row level security;

create policy "auth read purchase_purchase_requests"
  on public.purchase_purchase_requests for select to authenticated using (true);

create policy "admin manage purchase_purchase_requests"
  on public.purchase_purchase_requests for all to authenticated
  using (is_admin()) with check (is_admin());
