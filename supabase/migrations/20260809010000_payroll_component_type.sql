-- Payroll components (formerly "allowances") can be an earning or a deduction.
ALTER TABLE public.allowances
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'earning'
    CHECK (type IN ('earning', 'deduction'));
