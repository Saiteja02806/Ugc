create table if not exists public.oauth_states (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  platform text not null
    check (platform in ('instagram', 'tiktok', 'youtube')),
  state_hash text not null unique,
  code_verifier text,
  redirect_to text not null default '/connected-accounts',
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.oauth_states enable row level security;
revoke all privileges on table public.oauth_states from anon, authenticated;
grant select, insert, update, delete on table public.oauth_states to service_role;

create index if not exists oauth_states_platform_hash_idx
  on public.oauth_states (platform, state_hash);

create index if not exists oauth_states_expiry_idx
  on public.oauth_states (expires_at)
  where consumed_at is null;

create table if not exists public.social_connections (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  platform text not null
    check (platform in ('instagram', 'tiktok', 'youtube')),
  platform_account_id text not null,
  platform_account_name text,
  platform_account_username text,
  scopes text[] not null default '{}',
  access_token_ciphertext text not null,
  refresh_token_ciphertext text,
  token_type text,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz
);

alter table public.social_connections enable row level security;
revoke all privileges on table public.social_connections from anon, authenticated;
grant select, insert, update, delete on table public.social_connections to service_role;

create unique index if not exists social_connections_active_account_idx
  on public.social_connections (user_id, platform, platform_account_id)
  where revoked_at is null;

create index if not exists social_connections_user_platform_idx
  on public.social_connections (user_id, platform, updated_at desc);
