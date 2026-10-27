-- Account-owned Trending Slideshow Automation configuration, saved visual styles,
-- and idempotent daily slot snapshots.

create table public.trending_carousel_visual_styles (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (length(user_id) between 1 and 128),
  name text not null check (length(trim(name)) between 1 and 60),
  style jsonb not null,
  text_position jsonb not null default '{"x":0.5,"y":0.5}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(style) = 'object' and octet_length(style::text) <= 8192),
  check (jsonb_typeof(text_position) = 'object' and octet_length(text_position::text) <= 512)
);

create index trending_carousel_visual_styles_user_updated_idx
  on public.trending_carousel_visual_styles (user_id, updated_at desc);

alter table public.trending_carousel_visual_styles enable row level security;
revoke all on public.trending_carousel_visual_styles from public, anon, authenticated;
grant select, insert, update, delete on public.trending_carousel_visual_styles to service_role;

create table public.trending_slideshow_automations (
  user_id text primary key check (length(user_id) between 1 and 128),
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'needs_attention')),
  config jsonb not null,
  rotation_cursor integer not null default 0 check (rotation_cursor >= 0),
  revision integer not null default 1 check (revision > 0),
  attention_reason text check (
    attention_reason is null or
    attention_reason in (
      'collection_empty',
      'collection_missing',
      'account_reconnect_required',
      'allowance_reached'
    )
  ),
  attention_message text check (attention_message is null or length(attention_message) <= 600),
  activated_at timestamptz,
  paused_at timestamptz,
  updated_at timestamptz not null default now(),
  check (jsonb_typeof(config) = 'object' and octet_length(config::text) <= 65536)
);

alter table public.trending_slideshow_automations enable row level security;
revoke all on public.trending_slideshow_automations from public, anon, authenticated;
grant select, insert, update, delete on public.trending_slideshow_automations to service_role;

create table public.trending_slideshow_automation_slots (
  id uuid primary key default gen_random_uuid(),
  user_id text not null check (length(user_id) between 1 and 128),
  local_date text not null check (local_date ~ '^\d{4}-\d{2}-\d{2}$'),
  slot_time text not null check (slot_time ~ '^([01]\d|2[0-3]):([0-5]\d)$'),
  slot_index integer not null check (slot_index between 1 and 5),
  format text not null check (format in ('educational_tips', 'product_stories')),
  timezone text not null check (length(timezone) between 1 and 100),
  scheduled_for timestamptz not null,
  status text not null default 'preparing' check (
    status in (
      'preparing',
      'scheduled',
      'published',
      'partially_published',
      'held_collection_empty',
      'action_required_account',
      'missed_posting_time',
      'cancelled_by_user'
    )
  ),
  idempotency_key text not null check (length(idempotency_key) between 1 and 180),
  snapshot jsonb not null,
  creative_id text,
  library_item_id text,
  schedule_id text,
  user_modified boolean not null default false,
  hold_message text check (hold_message is null or length(hold_message) <= 600),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, local_date, slot_time),
  unique (idempotency_key),
  check (jsonb_typeof(snapshot) = 'object' and octet_length(snapshot::text) <= 65536)
);

create index trending_slideshow_automation_slots_user_scheduled_idx
  on public.trending_slideshow_automation_slots (user_id, scheduled_for asc);

alter table public.trending_slideshow_automation_slots enable row level security;
revoke all on public.trending_slideshow_automation_slots from public, anon, authenticated;
grant select, insert, update, delete on public.trending_slideshow_automation_slots to service_role;
