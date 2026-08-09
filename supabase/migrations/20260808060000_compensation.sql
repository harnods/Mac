-- Bank info + compensation on employees.
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bank_account_no text,
  ADD COLUMN IF NOT EXISTS account_holder_name text,
  ADD COLUMN IF NOT EXISTS basic_salary numeric,
  ADD COLUMN IF NOT EXISTS daily_allowance numeric,
  -- Additional allowances: [{ "allowance_id": uuid, "amount": number }]
  ADD COLUMN IF NOT EXISTS allowances jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Allowance master (catalog of allowance types).
CREATE TABLE IF NOT EXISTS public.allowances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.allowances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allowances read authenticated" ON public.allowances FOR SELECT TO authenticated USING (true);
CREATE POLICY "allowances write admin" ON public.allowances FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Built-in "Daily allowance" (paid per day) — cannot be deleted.
INSERT INTO public.allowances (name, is_default) VALUES ('Daily allowance', true)
ON CONFLICT (name) DO NOTHING;
