-- Loyalty points system

-- Singleton settings row (admin configures via UI)
CREATE TABLE public.loyalty_settings (
  id           INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  rp_per_point INTEGER NOT NULL DEFAULT 1000,  -- IDR needed to earn 1 point
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.loyalty_settings DEFAULT VALUES;

-- Customer loyalty accounts keyed by IG handle
CREATE TABLE public.loyalty_accounts (
  ig_handle    TEXT PRIMARY KEY,
  total_points INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Points ledger
CREATE TABLE public.loyalty_transactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ig_handle  TEXT NOT NULL REFERENCES public.loyalty_accounts(ig_handle) ON DELETE CASCADE,
  order_id   UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  points     INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track points state on orders
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS points_earned       INTEGER,
  ADD COLUMN IF NOT EXISTS points_claimed_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS loyalty_ig_handle   TEXT;

-- RLS
ALTER TABLE public.loyalty_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_accounts     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff manage loyalty settings"
  ON public.loyalty_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Staff read loyalty accounts"
  ON public.loyalty_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Staff read loyalty transactions"
  ON public.loyalty_transactions FOR SELECT TO authenticated USING (true);
