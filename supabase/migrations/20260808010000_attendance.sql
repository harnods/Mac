-- Shifts (master data): named work shift with a start/end time
CREATE TABLE IF NOT EXISTS public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(name)
);
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts read authenticated" ON public.shifts FOR SELECT TO authenticated USING (true);
CREATE POLICY "shifts write admin" ON public.shifts FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
-- Seed default cafe shifts
INSERT INTO public.shifts (name, start_time, end_time) VALUES
  ('Opening', '07:00', '15:00'),
  ('Midday',  '11:00', '19:00'),
  ('Closing', '15:00', '23:00')
ON CONFLICT (name) DO NOTHING;

-- Attendance: one clock in/out record per crew per work date
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  shift_id uuid REFERENCES public.shifts(id),
  work_date date NOT NULL,
  clock_in time,
  clock_out time,
  break_minutes int NOT NULL DEFAULT 0,
  note text,
  updated_by uuid REFERENCES public.profiles(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS attendance_employee_idx ON public.attendance(employee_id);
CREATE INDEX IF NOT EXISTS attendance_work_date_idx ON public.attendance(work_date);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attendance read authenticated" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance write admin" ON public.attendance FOR ALL TO authenticated USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed coherent mock attendance: for each existing crew, generate the last 7 days
-- of records rotating through the seeded shifts, with a mix of on-time / late / absent.
DO $$
DECLARE
  emp record;
  d int;
  wd date;
  sh record;
  shift_ids uuid[];
  ci time;
  co time;
  brk int;
  i int := 0;
BEGIN
  SELECT array_agg(id ORDER BY start_time) INTO shift_ids FROM public.shifts;
  IF shift_ids IS NULL THEN RETURN; END IF;

  FOR emp IN SELECT id FROM public.employees WHERE deleted_at IS NULL ORDER BY name LOOP
    FOR d IN 0..6 LOOP
      wd := (now() AT TIME ZONE 'Asia/Jakarta')::date - d;
      -- rotate shift per crew/day
      SELECT id, start_time, end_time INTO sh
        FROM public.shifts WHERE id = shift_ids[1 + ((i + d) % array_length(shift_ids, 1))];

      -- No scheduling module yet: a crew only has a record on days they clocked
      -- in. Skip one day per crew (d = 5) so there's simply no row that day.
      IF d = 5 THEN
        CONTINUE;
      END IF;
      -- late on d = 2 (18 min after start), otherwise 3 min early
      IF d = 2 THEN
        ci := sh.start_time + interval '18 minutes';
      ELSE
        ci := sh.start_time - interval '3 minutes';
      END IF;
      co := sh.end_time - interval '10 minutes';
      brk := CASE WHEN d % 2 = 0 THEN 60 ELSE 45 END;
      INSERT INTO public.attendance (employee_id, shift_id, work_date, clock_in, clock_out, break_minutes, note)
      VALUES (emp.id, sh.id, wd, ci, co, brk, NULL);
    END LOOP;
    i := i + 1;
  END LOOP;
END $$;
