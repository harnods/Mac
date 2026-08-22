-- Revoking a user's access deletes their auth user (cascading to profiles), but
-- many audit columns (created_by / updated_by / requested_by / …) referenced
-- profiles(id) with NO ACTION/RESTRICT, blocking the delete ("Database error
-- deleting user"). Convert every such FK to ON DELETE SET NULL so the records
-- are kept and the audit field is simply nulled when the user is removed.
DO $$
DECLARE r record; col text;
BEGIN
  FOR r IN
    SELECT conrelid::regclass AS tbl, conname, conkey
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.profiles'::regclass
      AND confdeltype IN ('a','r')
  LOOP
    SELECT attname INTO col FROM pg_attribute WHERE attrelid = r.tbl AND attnum = r.conkey[1];
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', r.tbl, col);
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL', r.tbl, r.conname, col);
  END LOOP;
END $$;

-- The order_shifts closed pair check blocked SET NULL of closed_by on delete.
-- Relax it so a closed shift may have a null closer (unknown), while still
-- forbidding a closer on a shift that isn't closed.
ALTER TABLE public.order_shifts DROP CONSTRAINT IF EXISTS order_shifts_closed_pair_check;
ALTER TABLE public.order_shifts ADD CONSTRAINT order_shifts_closed_pair_check
  CHECK (closed_at IS NOT NULL OR closed_by IS NULL);
