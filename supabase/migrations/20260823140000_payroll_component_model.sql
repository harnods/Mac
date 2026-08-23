-- Payroll components become the single way to attach pay to a crew.
--
-- 1) One-time payroll adjustments can now reference a payroll component. A
--    formula component computes at run; a non-formula one uses amount × rate
--    unit (per day / week / month) with an optional per-attendance flag.
ALTER TABLE public.payroll_adjustments
  ADD COLUMN IF NOT EXISTS allowance_id uuid REFERENCES public.allowances(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rate_unit text NOT NULL DEFAULT 'month' CHECK (rate_unit IN ('day','week','month')),
  ADD COLUMN IF NOT EXISTS per_attendance boolean NOT NULL DEFAULT false;

-- 2) Daily allowance is no longer a dedicated field — fold each crew's amount
--    into their payroll components (the seeded "Daily allowance" component,
--    per day, honouring the previous global per-attendance setting), then drop
--    the amount from the field so it isn't counted twice.
DO $$
DECLARE
  daily_id text;
  dba boolean;
BEGIN
  SELECT id::text INTO daily_id FROM public.allowances
    WHERE is_default AND name = 'Daily allowance' AND type = 'earning' LIMIT 1;
  IF daily_id IS NULL THEN RETURN; END IF;

  SELECT coalesce(daily_allowance_by_attendance, true) INTO dba
    FROM public.payroll_settings_versions ORDER BY effective_date DESC LIMIT 1;
  dba := coalesce(dba, true);

  UPDATE public.employees e
  SET allowances = coalesce(e.allowances, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'allowance_id', daily_id,
        'amount', e.daily_allowance,
        'rate_unit', 'day',
        'per_attendance', dba
      )),
      daily_allowance = NULL
  WHERE e.daily_allowance IS NOT NULL
    AND e.daily_allowance > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(coalesce(e.allowances, '[]'::jsonb)) x
      WHERE x->>'allowance_id' = daily_id
    );
END $$;
