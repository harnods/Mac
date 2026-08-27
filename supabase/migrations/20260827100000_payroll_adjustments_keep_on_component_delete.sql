-- One-time payroll adjustments (bonus, uniform/shirt deposit, …) must survive
-- deleting their referenced payroll component. Each adjustment already stores
-- its own label / type / amount snapshot, so losing the component must NOT
-- erase payroll history.
--
-- Bug: allowance_id used ON DELETE CASCADE, so deleting (or delete+recreating)
-- a payroll component silently wiped every adjustment that referenced it in
-- past payroll periods. Switch the FK to ON DELETE SET NULL — the adjustment
-- stays; only its (now-dangling) component reference is cleared. computePayslip
-- already falls back to the stored amount when allowance_id is null.
ALTER TABLE public.payroll_adjustments
  DROP CONSTRAINT IF EXISTS payroll_adjustments_allowance_id_fkey;

ALTER TABLE public.payroll_adjustments
  ADD CONSTRAINT payroll_adjustments_allowance_id_fkey
    FOREIGN KEY (allowance_id) REFERENCES public.allowances(id) ON DELETE SET NULL;
