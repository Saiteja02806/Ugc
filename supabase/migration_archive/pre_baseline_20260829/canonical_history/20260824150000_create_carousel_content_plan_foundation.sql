create unique index if not exists business_profiles_id_owner_project_uidx
  on public.business_profiles (id, user_id, project_id);

create table if not exists public.carousel_content_plans (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (char_length(trim(user_id)) between 1 and 240),
  project_id text not null
    check (char_length(trim(project_id)) between 1 and 240),
  business_profile_id uuid not null,
  business_profile_version integer not null
    check (business_profile_version > 0),
  period_start_date date not null,
  period_end_date date not null,
  timezone text not null
    check (char_length(trim(timezone)) between 1 and 100),
  plan_version integer not null default 1
    check (plan_version > 0),
  schema_version integer not null default 1
    check (schema_version = 1),
  business_description text not null
    check (char_length(trim(business_description)) between 1 and 4000),
  target_item_count integer not null default 150
    check (target_item_count between 150 and 10000),
  planner_model text not null default 'gpt-4o-mini'
    check (char_length(trim(planner_model)) between 1 and 120),
  planner_prompt_version text not null
    check (char_length(trim(planner_prompt_version)) between 1 and 160),
  status text not null default 'generating'
    check (
      status in (
        'generating',
        'active',
        'exhausted',
        'failed',
        'superseded'
      )
    ),
  activated_at timestamptz,
  exhausted_at timestamptz,
  failed_at timestamptz,
  failure_reason text,
  superseded_at timestamptz,
  superseded_by_plan_id uuid
    references public.carousel_content_plans(id)
    on delete no action
    deferrable initially deferred,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  foreign key (business_profile_id, user_id, project_id)
    references public.business_profiles (id, user_id, project_id)
    on delete cascade,
  unique (id, user_id),
  unique (
    business_profile_id,
    business_profile_version,
    period_start_date,
    plan_version
  ),
  check (period_end_date = period_start_date + 29),
  check (superseded_by_plan_id is null or superseded_by_plan_id <> id),
  check (
    (
      status = 'generating'
      and activated_at is null
      and exhausted_at is null
      and failed_at is null
      and failure_reason is null
      and superseded_at is null
      and superseded_by_plan_id is null
    )
    or
    (
      status = 'active'
      and activated_at is not null
      and exhausted_at is null
      and failed_at is null
      and failure_reason is null
      and superseded_at is null
      and superseded_by_plan_id is null
    )
    or
    (
      status = 'exhausted'
      and activated_at is not null
      and exhausted_at is not null
      and failed_at is null
      and failure_reason is null
      and superseded_at is null
      and superseded_by_plan_id is null
    )
    or
    (
      status = 'failed'
      and activated_at is null
      and exhausted_at is null
      and failed_at is not null
      and nullif(trim(coalesce(failure_reason, '')), '') is not null
      and superseded_at is null
      and superseded_by_plan_id is null
    )
    or
    (
      status = 'superseded'
      and exhausted_at is null
      and failed_at is null
      and failure_reason is null
      and superseded_at is not null
      and superseded_by_plan_id is not null
    )
  )
);

create unique index if not exists carousel_content_plans_active_period_uidx
  on public.carousel_content_plans (
    business_profile_id,
    business_profile_version,
    period_start_date
  )
  where status = 'active';

create index if not exists carousel_content_plans_owner_period_idx
  on public.carousel_content_plans (
    user_id,
    project_id,
    period_start_date desc,
    created_at desc
  );

create index if not exists carousel_content_plans_profile_status_idx
  on public.carousel_content_plans (
    business_profile_id,
    business_profile_version,
    status,
    period_start_date desc
  );

create table if not exists public.carousel_content_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null,
  user_id text not null
    check (char_length(trim(user_id)) between 1 and 240),
  sequence_index integer not null
    check (sequence_index > 0),
  day_number smallint not null
    check (day_number between 1 and 30),
  day_slot_index integer not null
    check (day_slot_index > 0),
  creative_seed text not null
    check (char_length(trim(creative_seed)) between 1 and 2000),
  emotion text not null
    check (char_length(trim(emotion)) between 1 and 240),
  seed_fingerprint text not null
    check (seed_fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'planned'
    check (status in ('planned', 'available', 'reserved', 'consumed', 'retired')),
  reservation_token uuid,
  reservation_key text
    check (
      reservation_key is null
      or char_length(trim(reservation_key)) between 1 and 240
    ),
  reserved_by_job_id uuid
    references public.background_jobs(id) on delete set null,
  reserved_at timestamptz,
  reservation_expires_at timestamptz,
  consumed_by_carousel_generation_id uuid
    references public.carousel_generations(id) on delete restrict,
  consumed_at timestamptz,
  retired_at timestamptz,
  retirement_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),

  foreign key (plan_id, user_id)
    references public.carousel_content_plans (id, user_id)
    on delete cascade,
  unique (plan_id, sequence_index),
  unique (plan_id, day_number, day_slot_index),
  unique (plan_id, seed_fingerprint),
  check (
    reservation_expires_at is null
    or reserved_at is null
    or reservation_expires_at > reserved_at
  ),
  check (
    (
      status in ('planned', 'available')
      and reservation_token is null
      and reservation_key is null
      and reserved_by_job_id is null
      and reserved_at is null
      and reservation_expires_at is null
      and consumed_by_carousel_generation_id is null
      and consumed_at is null
      and retired_at is null
      and retirement_reason is null
    )
    or
    (
      status = 'reserved'
      and reservation_token is not null
      and nullif(trim(coalesce(reservation_key, '')), '') is not null
      and reserved_at is not null
      and reservation_expires_at is not null
      and consumed_by_carousel_generation_id is null
      and consumed_at is null
      and retired_at is null
      and retirement_reason is null
    )
    or
    (
      status = 'consumed'
      and reservation_token is not null
      and nullif(trim(coalesce(reservation_key, '')), '') is not null
      and reserved_at is not null
      and reservation_expires_at is not null
      and consumed_by_carousel_generation_id is not null
      and consumed_at is not null
      and retired_at is null
      and retirement_reason is null
    )
    or
    (
      status = 'retired'
      and reservation_token is null
      and reservation_key is null
      and reserved_by_job_id is null
      and reserved_at is null
      and reservation_expires_at is null
      and consumed_by_carousel_generation_id is null
      and consumed_at is null
      and retired_at is not null
      and nullif(trim(coalesce(retirement_reason, '')), '') is not null
    )
  )
);

create index if not exists carousel_content_plan_items_available_idx
  on public.carousel_content_plan_items (plan_id, sequence_index)
  where status = 'available';

create index if not exists carousel_content_plan_items_reservation_expiry_idx
  on public.carousel_content_plan_items (reservation_expires_at, plan_id)
  where status = 'reserved';

create unique index if not exists carousel_content_plan_items_consumed_generation_uidx
  on public.carousel_content_plan_items (consumed_by_carousel_generation_id)
  where consumed_by_carousel_generation_id is not null;

alter table public.carousel_content_plans enable row level security;
alter table public.carousel_content_plan_items enable row level security;

revoke all privileges on table public.carousel_content_plans
  from public, anon, authenticated, service_role;
revoke all privileges on table public.carousel_content_plan_items
  from public, anon, authenticated, service_role;

grant select, insert, update on table public.carousel_content_plans
  to service_role;
grant select, insert, update on table public.carousel_content_plan_items
  to service_role;

comment on table public.carousel_content_plans is
  'Owner- and business-profile-version-scoped 30-day Carousel creative pool. A plan starts with at least 150 items and may be extended without a per-day consumption cap.';
comment on column public.carousel_content_plans.business_description is
  'Exact minimal business context snapshot intended for the Carousel plan writer; richer profile analysis is not part of the creative payload.';
comment on column public.carousel_content_plan_items.creative_seed is
  'Broad, open-ended creative starting thought. It must not prewrite a slide story.';
comment on column public.carousel_content_plan_items.emotion is
  'Required emotional undercurrent for the writer, not a required literal phrase or fixed plot.';
comment on column public.carousel_content_plan_items.day_number is
  'Organizational 1-30 grouping only. It does not impose a daily consumption limit.';
comment on column public.carousel_content_plan_items.seed_fingerprint is
  'System-only normalized SHA-256 duplicate key. It is not part of the creative prompt payload.';

select pg_notify('pgrst', 'reload schema');
