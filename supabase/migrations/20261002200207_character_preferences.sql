-- Per-account onboarding only. Firebase ownership is verified by the server;
-- browser Supabase roles have no access to this private table.
create table public.character_preferences (
  user_id text primary key check (char_length(btrim(user_id)) > 0 and char_length(user_id) <= 128),
  gender text check (gender is null or gender in ('male', 'female')),
  seen_at timestamptz not null default now()
);

alter table public.character_preferences enable row level security;

revoke all on table public.character_preferences from public, anon, authenticated;
revoke all on table public.character_preferences from service_role;
grant select, insert, update on table public.character_preferences to service_role;
