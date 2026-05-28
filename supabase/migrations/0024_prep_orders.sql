-- Prep Orders Migration

CREATE TABLE IF NOT EXISTS public.prep_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id),
  product_id uuid REFERENCES public.items(id),
  qty_to_prep numeric NOT NULL CHECK (qty_to_prep > 0),
  unit text NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'cancelled')),
  notes text CHECK (char_length(notes) <= 500),
  planned_date date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  updated_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.prep_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prep_order_id uuid NOT NULL REFERENCES public.prep_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id),
  qty_needed numeric NOT NULL,
  unit text NOT NULL,
  UNIQUE (prep_order_id, item_id)
);

-- Extend stock_ledger type check to include prep order types
ALTER TABLE public.stock_ledger
  DROP CONSTRAINT IF EXISTS stock_ledger_type_check;

ALTER TABLE public.stock_ledger
  ADD CONSTRAINT stock_ledger_type_check
  CHECK (type IN (
    'purchase',
    'pr_approved',
    'pr_rejected',
    'adjustment_in',
    'adjustment_out',
    'count_adjustment',
    'reservation',
    'reservation_release',
    'prep_consumption',
    'prep_output'
  ));

-- RLS for prep_orders
ALTER TABLE public.prep_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on prep_orders"
  ON public.prep_orders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Staff select on prep_orders"
  ON public.prep_orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
    )
  );

-- RLS for prep_order_items
ALTER TABLE public.prep_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on prep_order_items"
  ON public.prep_order_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Staff select on prep_order_items"
  ON public.prep_order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'staff'
    )
  );
