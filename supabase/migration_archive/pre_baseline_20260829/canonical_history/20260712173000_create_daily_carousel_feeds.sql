create table if not exists public.subscription_entitlements (
  plan_key text primary key,
  display_name text not null,
  daily_carousel_limit int not null check (daily_carousel_limit > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.subscription_entitlements (
  plan_key,
  display_name,
  daily_carousel_limit,
  is_active
)
values
  ('pro', 'Pro', 10, true),
  ('ultra_pro', 'Ultra Pro', 20, true)
on conflict (plan_key) do update
set
  display_name = excluded.display_name,
  daily_carousel_limit = excluded.daily_carousel_limit,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists public.user_subscription_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  plan_key text not null references public.subscription_entitlements(plan_key),
  is_active boolean not null default true,
  source text not null default 'manual'
    check (source in ('manual', 'billing', 'system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists user_subscription_plans_active_uidx
  on public.user_subscription_plans (user_id)
  where is_active;

create index if not exists user_subscription_plans_user_updated_idx
  on public.user_subscription_plans (user_id, updated_at desc);

create table if not exists public.user_carousel_assignments (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  project_id text not null,
  business_profile_id uuid references public.business_profiles(id) on delete set null,
  business_profile_version int,
  carousel_id uuid not null references public.carousel_generations(id) on delete restrict,
  state text not null default 'pending'
    check (
      state in (
        'pending',
        'in_progress',
        'completed_skipped',
        'completed_saved',
        'completed_scheduled',
        'failed'
      )
    ),
  concept_fingerprint text,
  first_assigned_at timestamptz not null default now(),
  first_assigned_local_date date,
  last_assigned_local_date date,
  first_shown_at timestamptz,
  completed_at timestamptz,
  completion_action text
    check (
      completion_action is null
      or completion_action in ('skipped', 'saved', 'scheduled')
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, carousel_id)
);

create index if not exists user_carousel_assignments_user_state_idx
  on public.user_carousel_assignments (
    user_id,
    state,
    first_assigned_at,
    created_at
  );

create index if not exists user_carousel_assignments_profile_idx
  on public.user_carousel_assignments (
    user_id,
    project_id,
    business_profile_id,
    business_profile_version
  );

create table if not exists public.daily_carousel_feeds (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  local_date date not null,
  timezone text not null,
  plan_key text not null references public.subscription_entitlements(plan_key),
  daily_limit int not null check (daily_limit > 0),
  status text not null default 'ready'
    check (status in ('preparing', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id, local_date)
);

create index if not exists daily_carousel_feeds_user_date_idx
  on public.daily_carousel_feeds (user_id, local_date desc);

create table if not exists public.daily_carousel_feed_items (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.daily_carousel_feeds(id) on delete cascade,
  assignment_id uuid not null references public.user_carousel_assignments(id) on delete cascade,
  position int not null check (position > 0),
  source text not null
    check (source in ('new', 'carried')),
  carried_from_date date,
  created_at timestamptz not null default now(),

  unique (feed_id, position),
  unique (feed_id, assignment_id)
);

create index if not exists daily_carousel_feed_items_feed_position_idx
  on public.daily_carousel_feed_items (feed_id, position);

create index if not exists daily_carousel_feed_items_assignment_idx
  on public.daily_carousel_feed_items (assignment_id);

alter table public.subscription_entitlements enable row level security;
alter table public.user_subscription_plans enable row level security;
alter table public.user_carousel_assignments enable row level security;
alter table public.daily_carousel_feeds enable row level security;
alter table public.daily_carousel_feed_items enable row level security;

revoke all privileges on table public.subscription_entitlements
  from anon, authenticated;
revoke all privileges on table public.user_subscription_plans
  from anon, authenticated;
revoke all privileges on table public.user_carousel_assignments
  from anon, authenticated;
revoke all privileges on table public.daily_carousel_feeds
  from anon, authenticated;
revoke all privileges on table public.daily_carousel_feed_items
  from anon, authenticated;

grant select, insert, update on table public.subscription_entitlements
  to service_role;
grant select, insert, update on table public.user_subscription_plans
  to service_role;
grant select, insert, update on table public.user_carousel_assignments
  to service_role;
grant select, insert, update on table public.daily_carousel_feeds
  to service_role;
grant select, insert, update on table public.daily_carousel_feed_items
  to service_role;

select pg_notify('pgrst', 'reload schema');
