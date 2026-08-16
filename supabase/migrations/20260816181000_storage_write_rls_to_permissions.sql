-- Align Storage bucket write policies with the permission model (were admin-only).
-- product-images: any item writer may upload/replace/remove item & product photos.
-- crew-photos: whoever manages employees (employees:write) may manage crew photos.
-- Additive/permission-aware; admin access unchanged.

-- ── product-images ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "product images admin insert" ON storage.objects;
DROP POLICY IF EXISTS "product images write insert" ON storage.objects;
CREATE POLICY "product images write insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (
    public.is_admin() OR public.has_permission('products:write') OR public.has_permission('assets:write')
    OR public.has_permission('ingredients:write') OR public.has_permission('prep_items:write')));
DROP POLICY IF EXISTS "product images admin update" ON storage.objects;
DROP POLICY IF EXISTS "product images write update" ON storage.objects;
CREATE POLICY "product images write update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'product-images' AND (
    public.is_admin() OR public.has_permission('products:write') OR public.has_permission('assets:write')
    OR public.has_permission('ingredients:write') OR public.has_permission('prep_items:write')));
DROP POLICY IF EXISTS "product images admin delete" ON storage.objects;
DROP POLICY IF EXISTS "product images write delete" ON storage.objects;
CREATE POLICY "product images write delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (
    public.is_admin() OR public.has_permission('products:write') OR public.has_permission('assets:write')
    OR public.has_permission('ingredients:write') OR public.has_permission('prep_items:write')));

-- ── crew-photos ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "crew photos write insert" ON storage.objects;
CREATE POLICY "crew photos write insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'crew-photos' AND (public.is_admin() OR public.has_permission('employees:write')));
DROP POLICY IF EXISTS "crew photos write update" ON storage.objects;
CREATE POLICY "crew photos write update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'crew-photos' AND (public.is_admin() OR public.has_permission('employees:write')));
DROP POLICY IF EXISTS "crew photos write delete" ON storage.objects;
CREATE POLICY "crew photos write delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'crew-photos' AND (public.is_admin() OR public.has_permission('employees:write')));
