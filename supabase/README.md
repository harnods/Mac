# Database — single production Supabase

There is **one** database: the cloud Supabase project. Local development and
the Vercel deployment both point at it. There is no local Postgres anymore.

| Environment | Database | Config |
|---|---|---|
| **Local dev** | Cloud Supabase (production) | `.env.local` (prod URL + keys) |
| **Production** | Same cloud Supabase | Vercel env vars |

> ⚠️ Local dev writes to **real production data**. There is no separate staging
> DB — test destructive changes carefully.

The project is **not linked** to the CLI (`supabase link` was never run), so
`supabase db push` / `db pull` are not used. Production schema is managed
manually via the Supabase dashboard **SQL Editor**.

## Local dev workflow

```bash
npm run dev             # app → http://localhost:3006 (uses prod Supabase)
```

`.env.local` holds the production `NEXT_PUBLIC_SUPABASE_URL`, anon key, and
service-role key (see `.env.local.prod-backup`). Payment provider is kept on
`mock` locally so DOKU isn't charged during dev.

## Migrations

`supabase/migrations/` is the source-of-truth history for schema changes.
Since there is no local DB to reset against, a new migration is applied by:

1. Add a new timestamped migration in `migrations/` (e.g. `20260827100000_*.sql`).
2. Apply it by pasting the same SQL into the production project's **SQL Editor**
   in the Supabase dashboard.

The migration files are the written record; the SQL Editor is how they reach
the (only) database.
