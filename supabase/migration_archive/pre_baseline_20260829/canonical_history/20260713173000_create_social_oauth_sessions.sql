create table if not exists public.social_oauth_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  provider text not null
    check (provider in ('meta', 'tiktok', 'google')),
  platform text not null
    check (platform in ('instagram', 'tiktok', 'youtube')),
  state_hash text not null unique,
  code_verifier text,
  library_item_id uuid references public.library_items(id) on delete set null,
  carousel_id text,
  return_to text not null default 'accounts'
    check (return_to in ('accounts', 'library', 'trending')),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (provider = 'meta' and platform = 'instagram') or
    (provider = 'tiktok' and platform = 'tiktok') or
    (provider = 'google' and platform = 'youtube')
  )
);

alter table public.social_oauth_sessions enable row level security;
revoke all privileges on table public.social_oauth_sessions from anon, authenticated;
grant select, insert, update, delete on table public.social_oauth_sessions to service_role;

create index if not exists social_oauth_sessions_provider_state_idx
  on public.social_oauth_sessions (provider, platform, state_hash);

create index if not exists social_oauth_sessions_expiry_idx
  on public.social_oauth_sessions (expires_at)
  where consumed_at is null;

alter table public.social_connections
  add column if not exists provider text,
  add column if not exists status text not null default 'connected',
  add column if not exists last_error_code text;

update public.social_connections
set provider = case platform
  when 'instagram' then 'meta'
  when 'tiktok' then 'tiktok'
  when 'youtube' then 'google'
end
where provider is null;

alter table public.social_connections
  alter column provider set not null;

alter table public.social_connections
  drop constraint if exists social_connections_provider_check,
  drop constraint if exists social_connections_status_check,
  drop constraint if exists social_connections_provider_platform_check;

alter table public.social_connections
  add constraint social_connections_provider_check
    check (provider in ('meta', 'tiktok', 'google')),
  add constraint social_connections_status_check
    check (status in ('connected', 'expired', 'revoked', 'permission_missing', 'error')),
  add constraint social_connections_provider_platform_check
    check (
      (provider = 'meta' and platform = 'instagram') or
      (provider = 'tiktok' and platform = 'tiktok') or
      (provider = 'google' and platform = 'youtube')
    );

drop index if exists public.social_connections_active_account_idx;

create unique index if not exists social_connections_user_provider_account_idx
  on public.social_connections (user_id, provider, platform_account_id);

create index if not exists social_connections_user_status_idx
  on public.social_connections (user_id, status, updated_at desc);
