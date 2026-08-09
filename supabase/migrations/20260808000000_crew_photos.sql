-- Crew (employee) profile photos.
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url text;

-- Public bucket: photos are served via public URL. Uploads are compressed
-- client-side before hitting the bucket to keep files small.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('crew-photos', 'crew-photos', true, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "crew photos public read" on storage.objects
  for select using (bucket_id = 'crew-photos');

create policy "crew photos admin insert" on storage.objects
  for insert with check (bucket_id = 'crew-photos' and public.is_admin());

create policy "crew photos admin update" on storage.objects
  for update using (bucket_id = 'crew-photos' and public.is_admin());

create policy "crew photos admin delete" on storage.objects
  for delete using (bucket_id = 'crew-photos' and public.is_admin());
