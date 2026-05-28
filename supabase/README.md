# Database — local staging vs. production

Two fully separate databases:

| Environment | Database | Used by |
|---|---|---|
| **Local staging** | Local Supabase (`supabase start`, Docker) | Your machine via `.env.local` |
| **Production** | Cloud Supabase project | Vercel deployment (env vars set in Vercel) |

Local and production never share data. Local is **not linked** to the cloud
project (`supabase link` was never run), so `supabase db push` / `db pull`
cannot touch production.

> ⚠️ **Do not** run `supabase link` against the production project or
> `supabase db push`. Production schema is managed manually via the Supabase
> dashboard SQL editor. Pushing from the CLI would conflict with its
> migration history.

## Local dev workflow

```bash
supabase start          # boot local Postgres + Auth (Docker)
node scripts/seed-users.mjs   # create admin/staff (random passwords printed)
npm run dev             # app → http://localhost:4321

supabase stop           # shut down (data persists across stop/start)
supabase status         # show local URL + keys
supabase db reset       # rebuild schema from migrations/, then re-seed users
```

Studio (local data browser): http://127.0.0.1:54323

## Migrations

`supabase/migrations/` is the single source of truth. `supabase db reset`
applies every migration in order on a clean database, so local is fully
reproducible. After a reset, re-run `node scripts/seed-users.mjs` (reset
wipes data, including auth users).

Note: `config.toml` disables the `storage` and `analytics` containers —
they fail to start under Colima and the app uses neither.

## Applying a new schema change to production

1. Add a new numbered migration in `migrations/` (e.g. `0030_*.sql`).
2. Test locally with `supabase db reset`.
3. Apply to production by pasting the same SQL into the production project's
   **SQL Editor** in the Supabase dashboard.
