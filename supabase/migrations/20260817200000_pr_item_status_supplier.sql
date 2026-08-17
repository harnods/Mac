-- Per-item approval + supplier on purchase request items. Approve/reject and
-- supplier are now decided per requested item, not per whole request.
ALTER TABLE public.purchase_request_items
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS purchase_request_items_supplier_idx ON public.purchase_request_items (supplier_id);

-- Seed existing item statuses from their request's overall status, and copy the
-- request-level supplier down to each item as a starting point.
UPDATE public.purchase_request_items pri
SET status = pr.status
FROM public.purchase_requests pr
WHERE pri.request_id = pr.id AND pr.status IN ('approved', 'rejected');

UPDATE public.purchase_request_items pri
SET supplier_id = pr.supplier_id
FROM public.purchase_requests pr
WHERE pri.request_id = pr.id AND pr.supplier_id IS NOT NULL AND pri.supplier_id IS NULL;
