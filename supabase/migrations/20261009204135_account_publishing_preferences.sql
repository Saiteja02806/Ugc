-- Firebase-authenticated API only. Direct browser access is intentionally denied.
create table public.user_publishing_preferences (
  user_id text primary key check (length(user_id) > 0),
  contains_synthetic_media boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.user_publishing_preferences enable row level security;
revoke all on public.user_publishing_preferences from public, anon, authenticated;
grant select, insert, update on public.user_publishing_preferences to service_role;
