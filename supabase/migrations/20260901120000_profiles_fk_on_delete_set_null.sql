-- Revoking a login deletes the auth user, which cascades to its profile row.
-- Any audit/actor column pointing at that profile (created_by, updated_by,
-- actor_id, author_id, opened_by, …) with a blocking ON DELETE (NO ACTION /
-- RESTRICT) makes Postgres refuse the delete → "Database error deleting user".
--
-- Convert EVERY single-column foreign key referencing profiles(id) to
-- ON DELETE SET NULL so deleting a user just clears those references. For
-- NOT NULL columns (e.g. a shift's opened_by) drop the NOT NULL first so the
-- delete can null them — the row (and its data) is kept, only the "who" link
-- is cleared.
DO $$
DECLARE
  r record;
  col text;
  notnull boolean;
BEGIN
  FOR r IN
    SELECT c.conname, c.conrelid, c.conrelid::regclass::text AS tbl, c.conkey
    FROM pg_constraint c
    WHERE c.contype = 'f'
      AND c.confrelid = 'public.profiles'::regclass
      AND c.confdeltype <> 'n'                 -- not already SET NULL
      AND array_length(c.conkey, 1) = 1        -- single-column FKs only
  LOOP
    SELECT a.attname, a.attnotnull INTO col, notnull
    FROM pg_attribute a
    WHERE a.attrelid = r.conrelid AND a.attnum = r.conkey[1];

    IF notnull THEN
      EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP NOT NULL', r.tbl, col);
    END IF;

    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    EXECUTE format(
      'ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.profiles(id) ON DELETE SET NULL',
      r.tbl, r.conname, col
    );
  END LOOP;
END $$;
