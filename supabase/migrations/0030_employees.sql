-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "departments read authenticated" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments write admin" ON public.departments FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Job positions
CREATE TABLE IF NOT EXISTS public.job_positions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.job_positions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_positions read authenticated" ON public.job_positions FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_positions write admin" ON public.job_positions FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Employment statuses
CREATE TABLE IF NOT EXISTS public.employment_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.employment_statuses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employment_statuses read authenticated" ON public.employment_statuses FOR SELECT TO authenticated USING (true);
CREATE POLICY "employment_statuses write admin" ON public.employment_statuses FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Seed defaults
INSERT INTO public.employment_statuses (name) VALUES ('Permanent'), ('Contract'), ('Part-time') ON CONFLICT (name) DO NOTHING;

-- Job levels
CREATE TABLE IF NOT EXISTS public.job_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.job_levels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_levels read authenticated" ON public.job_levels FOR SELECT TO authenticated USING (true);
CREATE POLICY "job_levels write admin" ON public.job_levels FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  birthdate date,
  nik text,
  address text,
  marital_status text CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
  gender text CHECK (gender IN ('male', 'female')),
  department_id uuid REFERENCES public.departments(id),
  job_position_id uuid REFERENCES public.job_positions(id),
  job_level_id uuid REFERENCES public.job_levels(id),
  employment_status_id uuid REFERENCES public.employment_statuses(id),
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "employees read authenticated" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees write admin" ON public.employees FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
