-- Track who opens and closes the Orders shift/session.
CREATE TABLE public.order_shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opened_at timestamptz NOT NULL DEFAULT now(),
  opened_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  closed_at timestamptz,
  closed_by uuid REFERENCES public.profiles(id) ON DELETE RESTRICT,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT order_shifts_closed_pair_check CHECK (
    (closed_at IS NULL AND closed_by IS NULL)
    OR (closed_at IS NOT NULL AND closed_by IS NOT NULL)
  ),
  CONSTRAINT order_shifts_close_after_open_check CHECK (
    closed_at IS NULL OR closed_at >= opened_at
  )
);

CREATE UNIQUE INDEX order_shifts_one_open_idx
  ON public.order_shifts ((true))
  WHERE closed_at IS NULL;

CREATE INDEX order_shifts_opened_at_idx
  ON public.order_shifts (opened_at DESC);

ALTER TABLE public.order_shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "order_shifts read authenticated"
  ON public.order_shifts
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "order_shifts insert authenticated"
  ON public.order_shifts
  FOR INSERT TO authenticated
  WITH CHECK (opened_by = auth.uid() AND closed_at IS NULL AND closed_by IS NULL);

CREATE POLICY "order_shifts close authenticated"
  ON public.order_shifts
  FOR UPDATE TO authenticated
  USING (closed_at IS NULL)
  WITH CHECK (closed_by = auth.uid() AND closed_at IS NOT NULL);
