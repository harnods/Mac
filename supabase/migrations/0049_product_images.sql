-- Product photos, for display on the customer-facing order/POS menu.
ALTER TABLE public.items ADD COLUMN IF NOT EXISTS image_url text;

-- Public bucket: images are served directly via public URL (no auth needed
-- to view, since the POS/order screens are customer-facing and unauthenticated).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "product images public read" on storage.objects
  for select using (bucket_id = 'product-images');

create policy "product images admin insert" on storage.objects
  for insert with check (bucket_id = 'product-images' and public.is_admin());

create policy "product images admin update" on storage.objects
  for update using (bucket_id = 'product-images' and public.is_admin());

create policy "product images admin delete" on storage.objects
  for delete using (bucket_id = 'product-images' and public.is_admin());
