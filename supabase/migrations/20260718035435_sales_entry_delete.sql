-- Allow sales entries to be deleted (creation already allows any authenticated user;
-- mirror the same trust model for delete, matching "Authenticated can insert sales_entries").
CREATE POLICY "Authenticated can delete sales_entries"
  ON public.sales_entries FOR DELETE TO authenticated USING (true);

CREATE POLICY "Authenticated can delete sales_entry_items"
  ON public.sales_entry_items FOR DELETE TO authenticated USING (true);

-- Add sales_reversal to stock_ledger type constraint (stock restored when a sales entry is deleted)
ALTER TABLE public.stock_ledger
  DROP CONSTRAINT IF EXISTS stock_ledger_type_check;

ALTER TABLE public.stock_ledger
  ADD CONSTRAINT stock_ledger_type_check CHECK (type IN (
    'purchase', 'pr_approved', 'pr_rejected',
    'adjustment_in', 'adjustment_out', 'count_adjustment',
    'reservation', 'reservation_release',
    'prep_consumption', 'prep_output',
    'sales_consumption', 'sales_reversal'
  ));
