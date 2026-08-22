-- Team-wide weekly shift patterns. Each pattern has an effective date and, for
-- every crew, a shift per weekday (Mon=0 … Sun=6). A pattern repeats weekly
-- until the next pattern's effective date. Patterns generate rows in `schedules`
-- (source='pattern'); manual per-day edits (source='manual') are preserved.

ALTER TABLE public.schedules
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'manual';

CREATE TABLE IF NOT EXISTS public.roster_patterns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text,
  effective_date date NOT NULL,
  created_by     uuid REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.roster_shifts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id  uuid NOT NULL REFERENCES public.roster_patterns(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  weekday     int  NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  shift_id    uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  UNIQUE (pattern_id, employee_id, weekday)
);

ALTER TABLE public.roster_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_shifts   ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "roster_patterns read" ON public.roster_patterns FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "roster_patterns write" ON public.roster_patterns FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_permission('employees:write'))
    WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "roster_shifts read" ON public.roster_shifts FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "roster_shifts write" ON public.roster_shifts FOR ALL TO authenticated
    USING (public.is_admin() OR public.has_permission('employees:write'))
    WITH CHECK (public.is_admin() OR public.has_permission('employees:write'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Materialise a pattern into `schedules`, repeating weekly from its effective
-- date until the day before the next pattern (or +1 year), within each crew's
-- employment window. Preserves manual overrides.
CREATE OR REPLACE FUNCTION public.apply_roster_pattern(p_pattern uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE eff date; nexteff date; hor date;
BEGIN
  SELECT effective_date INTO eff FROM roster_patterns WHERE id = p_pattern;
  IF eff IS NULL THEN RETURN; END IF;
  SELECT min(effective_date) INTO nexteff FROM roster_patterns WHERE effective_date > eff;
  hor := LEAST(COALESCE(nexteff - 1, (eff + interval '1 year')::date), (eff + interval '1 year')::date);

  -- Clear pattern-generated rows in range (this also stops the previous pattern
  -- at the new effective date). Manual overrides are untouched.
  DELETE FROM schedules WHERE source = 'pattern' AND work_date >= eff AND work_date <= hor;

  INSERT INTO schedules (employee_id, work_date, shift_id, source)
  SELECT rs.employee_id, gs::date, rs.shift_id, 'pattern'
  FROM roster_shifts rs
  JOIN employees e ON e.id = rs.employee_id AND e.deleted_at IS NULL
  CROSS JOIN LATERAL generate_series(eff, hor, interval '1 day') gs
  WHERE rs.pattern_id = p_pattern
    AND rs.shift_id IS NOT NULL
    AND (extract(isodow FROM gs)::int - 1) = rs.weekday
    AND gs::date >= COALESCE(e.join_date, eff)
    AND gs::date <= COALESCE(LEAST(e.inactive_date, e.last_day, e.termination_date), hor)
  ON CONFLICT (employee_id, work_date) DO UPDATE
    SET shift_id = excluded.shift_id, source = 'pattern', updated_at = now()
    WHERE schedules.source = 'pattern';
END $$;
