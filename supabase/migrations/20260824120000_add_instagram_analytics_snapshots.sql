create table if not exists public.instagram_analytics_account_snapshots (
  user_id text not null,
  social_connection_id uuid not null
    references public.social_connections(id) on delete cascade,
  range_days smallint not null check (range_days in (7, 30, 90)),
  snapshot_json jsonb not null
    check (jsonb_typeof(snapshot_json) = 'object'),
  synced_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, social_connection_id, range_days)
);

alter table public.instagram_analytics_account_snapshots enable row level security;
revoke all privileges on table public.instagram_analytics_account_snapshots
  from anon, authenticated;
grant select, insert, update, delete
  on table public.instagram_analytics_account_snapshots to service_role;

create index if not exists instagram_analytics_account_snapshots_owner_range_idx
  on public.instagram_analytics_account_snapshots (user_id, range_days, synced_at desc);

create table if not exists public.instagram_analytics_connection_snapshots (
  user_id text not null,
  social_connection_id uuid not null
    references public.social_connections(id) on delete cascade,
  range_days smallint not null check (range_days in (7, 30, 90)),
  account_name text,
  account_username text,
  status text not null
    check (status in ('error', 'permission_missing', 'ready', 'unavailable')),
  message text,
  feed_synced_at timestamptz,
  last_synced_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, social_connection_id, range_days)
);

alter table public.instagram_analytics_connection_snapshots enable row level security;
revoke all privileges on table public.instagram_analytics_connection_snapshots
  from anon, authenticated;
grant select, insert, update, delete
  on table public.instagram_analytics_connection_snapshots to service_role;

create index if not exists instagram_analytics_connection_snapshots_owner_idx
  on public.instagram_analytics_connection_snapshots
    (user_id, range_days, updated_at desc);

create table if not exists public.instagram_analytics_content (
  user_id text not null,
  social_connection_id uuid not null
    references public.social_connections(id) on delete cascade,
  platform_media_id text not null,
  account_name text,
  account_username text,
  caption text,
  content_type text not null check (content_type in ('carousel', 'post', 'reel')),
  media_type text,
  permalink text,
  published_at timestamptz not null,
  thumbnail_url text,
  comments bigint check (comments is null or comments >= 0),
  interactions bigint check (interactions is null or interactions >= 0),
  likes bigint check (likes is null or likes >= 0),
  reach bigint check (reach is null or reach >= 0),
  saves bigint check (saves is null or saves >= 0),
  shares bigint check (shares is null or shares >= 0),
  views bigint check (views is null or views >= 0),
  metrics_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, social_connection_id, platform_media_id)
);

alter table public.instagram_analytics_content enable row level security;
revoke all privileges on table public.instagram_analytics_content
  from anon, authenticated;
grant select, insert, update, delete
  on table public.instagram_analytics_content to service_role;

create index if not exists instagram_analytics_content_owner_published_idx
  on public.instagram_analytics_content (user_id, published_at desc);

create index if not exists instagram_analytics_content_connection_published_idx
  on public.instagram_analytics_content
    (social_connection_id, published_at desc);
