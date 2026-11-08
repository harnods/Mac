-- Telegram bot for purchase requests.
--
-- Employees DM the bot ("almond 2kg, ayam 5 ekor"); the bot parses the text
-- into ingredients, asks for confirmation, creates a purchase request, posts a
-- summary to the Purchase Requests group and splits the items into one group
-- per (primary) supplier.
--
-- The bot runs server-side with the service-role key, so the bot-only tables
-- below have RLS enabled with no policies for regular users unless noted.

-- Groups/chats the bot has been added to (recorded from Telegram updates), so
-- admins can pick them in the web app instead of typing chat ids.
CREATE TABLE IF NOT EXISTS public.telegram_chats (
  chat_id    bigint PRIMARY KEY,
  title      text,
  type       text NOT NULL,                 -- group | supergroup | channel | private
  is_member  boolean NOT NULL DEFAULT true, -- false once the bot is removed
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Singleton settings row (id = 1).
CREATE TABLE IF NOT EXISTS public.telegram_settings (
  id                   int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  pr_chat_id           bigint REFERENCES public.telegram_chats(chat_id) ON DELETE SET NULL,
  updated_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.telegram_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Each supplier's Telegram group (internal purchasing team per supplier).
ALTER TABLE public.suppliers
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint REFERENCES public.telegram_chats(chat_id) ON DELETE SET NULL;

-- Telegram user ↔ Machitori profile.
CREATE TABLE IF NOT EXISTS public.telegram_accounts (
  telegram_user_id  bigint PRIMARY KEY,
  profile_id        uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  telegram_username text,
  telegram_name     text,
  linked_at         timestamptz NOT NULL DEFAULT now()
);

-- One-time codes for linking (deep link t.me/<bot>?start=<code>).
CREATE TABLE IF NOT EXISTS public.telegram_link_codes (
  code       text PRIMARY KEY,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_link_codes_profile_idx ON public.telegram_link_codes (profile_id);

-- Parsed-but-unconfirmed requests (the bot's "Kirim / Batal" step).
CREATE TABLE IF NOT EXISTS public.telegram_pr_drafts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_user_id bigint NOT NULL,
  profile_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  source_text      text NOT NULL,
  items            jsonb NOT NULL,          -- [{ item_id, name, qty, unit }]
  unmatched        jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{ raw, reason }]
  status           text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'submitted', 'cancelled')),
  request_id       uuid REFERENCES public.purchase_requests(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS telegram_pr_drafts_user_idx ON public.telegram_pr_drafts (telegram_user_id, created_at DESC);

DROP TRIGGER IF EXISTS telegram_pr_drafts_touch ON public.telegram_pr_drafts;
CREATE TRIGGER telegram_pr_drafts_touch
BEFORE UPDATE ON public.telegram_pr_drafts
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Webhook dedupe: Telegram retries an update until it gets a 2xx.
CREATE TABLE IF NOT EXISTS public.telegram_updates (
  update_id   bigint PRIMARY KEY,
  received_at timestamptz NOT NULL DEFAULT now()
);

-- Where a purchase request came from.
ALTER TABLE public.purchase_requests
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'telegram'));

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.telegram_chats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_accounts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_pr_drafts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.telegram_updates    ENABLE ROW LEVEL SECURITY;

-- Purchasing staff can see known groups and manage the settings.
DROP POLICY IF EXISTS "telegram_chats read" ON public.telegram_chats;
CREATE POLICY "telegram_chats read" ON public.telegram_chats
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_permission('purchasing:purchase') OR public.has_permission('purchasing:request'));

DROP POLICY IF EXISTS "telegram_settings read" ON public.telegram_settings;
CREATE POLICY "telegram_settings read" ON public.telegram_settings
  FOR SELECT TO authenticated
  USING (public.is_admin() OR public.has_permission('purchasing:purchase') OR public.has_permission('purchasing:request'));
DROP POLICY IF EXISTS "telegram_settings write" ON public.telegram_settings;
CREATE POLICY "telegram_settings write" ON public.telegram_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin() OR public.has_permission('purchasing:purchase'))
  WITH CHECK (public.is_admin() OR public.has_permission('purchasing:purchase'));

-- A user sees (and can unlink) their own Telegram account; purchasing admins see all.
DROP POLICY IF EXISTS "telegram_accounts read" ON public.telegram_accounts;
CREATE POLICY "telegram_accounts read" ON public.telegram_accounts
  FOR SELECT TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin() OR public.has_permission('purchasing:purchase'));
DROP POLICY IF EXISTS "telegram_accounts delete own" ON public.telegram_accounts;
CREATE POLICY "telegram_accounts delete own" ON public.telegram_accounts
  FOR DELETE TO authenticated
  USING (profile_id = auth.uid() OR public.is_admin());

-- Users create link codes for themselves only.
DROP POLICY IF EXISTS "telegram_link_codes insert own" ON public.telegram_link_codes;
CREATE POLICY "telegram_link_codes insert own" ON public.telegram_link_codes
  FOR INSERT TO authenticated
  WITH CHECK (profile_id = auth.uid());
-- telegram_pr_drafts / telegram_updates: service role only (no policies).
