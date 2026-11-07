create table if not exists rate_limits (
  key text primary key,
  count int not null default 1,
  reset_at timestamptz not null
);

alter table rate_limits enable row level security;

create index idx_rate_limits_reset_at on rate_limits (reset_at);

create or replace function clean_expired_rate_limits()
returns void language sql security definer as $$
  delete from rate_limits where reset_at < now();
$$;
