-- Additive, account-scoped rollout. No accounts are enabled by this migration.
create table public.wall_text_early_delivery_accounts (
  user_id text primary key,
  enabled boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.wall_text_content_plans
  add column published_item_count integer not null default 0
    check (published_item_count between 0 and 200 and published_item_count % 5 = 0),
  add column early_delivery_enabled boolean not null default false;

create table public.wall_text_plan_publications (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.wall_text_content_plans(id) on delete cascade,
  user_id text not null,
  item_count integer not null check (item_count between 5 and 200 and item_count % 5 = 0),
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed')),
  claim_token uuid,
  locked_at timestamptz,
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (plan_id, item_count)
);
create index wall_text_plan_publications_due_idx
  on public.wall_text_plan_publications(next_attempt_at, created_at)
  where status <> 'completed';

-- An intent owns a fixed daily demand, independently of changing creative counts.
-- Job retries keep this identity. Explicit user retries have a new feed retry key.
create table public.wall_text_daily_delivery_intents (
  id uuid primary key default gen_random_uuid(),
  feed_id uuid not null references public.daily_trending_feeds(id) on delete cascade,
  user_id text not null,
  retry_key text not null,
  generator_version text not null,
  layout_version text not null,
  slot_count integer not null check (slot_count between 1 and 50),
  slot_ids uuid[] not null check (cardinality(slot_ids) between 1 and 50),
  plan_id uuid not null references public.wall_text_content_plans(id),
  job_id uuid not null references public.background_jobs(id),
  created_at timestamptz not null default now(),
  unique (feed_id, retry_key, slot_count, generator_version, layout_version)
);
create index wall_text_daily_delivery_intents_job_idx
  on public.wall_text_daily_delivery_intents(job_id);

alter table public.wall_text_early_delivery_accounts enable row level security;
alter table public.wall_text_plan_publications enable row level security;
alter table public.wall_text_daily_delivery_intents enable row level security;
revoke all on public.wall_text_early_delivery_accounts, public.wall_text_plan_publications,
  public.wall_text_daily_delivery_intents from public, anon, authenticated;
grant all on public.wall_text_early_delivery_accounts, public.wall_text_plan_publications,
  public.wall_text_daily_delivery_intents to service_role;

create function public.initialize_wall_text_early_delivery()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.early_delivery_enabled := coalesce((select enabled
    from public.wall_text_early_delivery_accounts where user_id = new.user_id), false);
  return new;
end;
$$;
create trigger initialize_wall_text_early_delivery
  before insert on public.wall_text_content_plans
  for each row execute function public.initialize_wall_text_early_delivery();

-- Fence before taking the plan lock, matching background-job terminalization.
create function public.assert_wall_text_planner_claim(p_user_id text, p_plan_id uuid,
  p_job_id uuid, p_claim_token uuid)
returns void language plpgsql set search_path = '' as $$
begin
  perform 1 from public.background_jobs j
  where j.id = p_job_id and j.user_id = p_user_id
    and j.job_type = 'wall_text_content_plan_generation'
    and j.input_json ->> 'planId' = p_plan_id::text
    and j.claim_token = p_claim_token
    and j.status in ('processing', 'waiting_external_service')
    and j.cancel_requested_at is null
  for update;
  if not found then raise exception 'wall_text_planner_claim_lost'; end if;
  perform 1 from public.wall_text_content_plans p
  where p.id = p_plan_id and p.user_id = p_user_id and p.generation_job_id = p_job_id
  for update;
  if not found then raise exception 'wall_text_planner_owner_changed'; end if;
end;
$$;

create function public.persist_wall_text_content_plan_brief_chunk_v2(
  p_user_id text, p_plan_id uuid, p_job_id uuid, p_claim_token uuid,
  p_expected_item_count integer, p_briefs jsonb, p_items jsonb)
returns setof public.wall_text_content_plan_items
language plpgsql set search_path = '' as $$
declare
  v_count integer;
  v_new_count integer;
begin
  perform public.assert_wall_text_planner_claim(p_user_id, p_plan_id, p_job_id, p_claim_token);
  select count(*) into v_count from public.wall_text_content_plan_items where plan_id = p_plan_id;
  if p_expected_item_count is null or v_count <> p_expected_item_count then
    raise exception 'wall_text_plan_chunk_position_changed';
  end if;
  v_new_count := v_count + jsonb_array_length(p_items);
  if jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_typeof(p_briefs) is distinct from 'array'
    or jsonb_array_length(p_items) not in (5, 10)
    or exists (
      select 1 from jsonb_array_elements(p_items) with ordinality as item(value, n)
      where (value ->> 'sequence_index')::integer is distinct from v_count + n
        or (value ->> 'brief_index')::integer is distinct from (v_count + n - 1) / 5 + 1
        or jsonb_typeof(value -> 'private_context') is distinct from 'object'
    ) then raise exception 'wall_text_plan_publication_shape_invalid'; end if;
  -- Legacy validation still enforces fingerprints, complete briefs and target size.
  return query select * from public.persist_wall_text_content_plan_brief_chunk_unfenced(
    p_user_id, p_plan_id, p_briefs, p_items);
  update public.wall_text_content_plans
    set published_item_count = v_new_count, updated_at = now() where id = p_plan_id;
  insert into public.wall_text_plan_publications(plan_id, user_id, item_count)
  select p.id, p.user_id, v_new_count from public.wall_text_content_plans p
  join public.wall_text_early_delivery_accounts a on a.user_id = p.user_id and a.enabled
  where p.id = p_plan_id and p.early_delivery_enabled
  on conflict (plan_id, item_count) do nothing;
end;
$$;

create function public.complete_wall_text_content_plan_generation_v2(
  p_user_id text, p_plan_id uuid, p_job_id uuid, p_claim_token uuid)
returns public.wall_text_content_plans language plpgsql set search_path = '' as $$
begin
  perform public.assert_wall_text_planner_claim(p_user_id, p_plan_id, p_job_id, p_claim_token);
  return public.complete_wall_text_content_plan_generation_unfenced(p_user_id, p_plan_id, p_job_id);
end;
$$;

create function public.claim_wall_text_plan_publications(p_limit integer default 10, p_plan_id uuid default null)
returns setof public.wall_text_plan_publications language plpgsql set search_path = '' as $$
begin
  return query
  with due as (
    select e.id from public.wall_text_plan_publications e
    where (p_plan_id is null or e.plan_id = p_plan_id)
      and ((e.status = 'pending' and e.next_attempt_at <= now())
        or (e.status = 'processing' and e.locked_at < now() - interval '5 minutes'))
    order by e.next_attempt_at, e.created_at
    limit greatest(1, least(coalesce(p_limit, 10), 25)) for update skip locked
  )
  update public.wall_text_plan_publications e
  set status = 'processing', claim_token = gen_random_uuid(), locked_at = now(),
    attempt_count = e.attempt_count + 1
  from due where e.id = due.id returning e.*;
end;
$$;

create function public.finish_wall_text_plan_publication(p_id uuid, p_claim_token uuid, p_error text default null)
returns boolean language plpgsql set search_path = '' as $$
begin
  update public.wall_text_plan_publications
  set status = case when p_error is null then 'completed' else 'pending' end,
    completed_at = case when p_error is null then now() else null end,
    next_attempt_at = now() + interval '1 minute', last_error = left(p_error, 1000),
    claim_token = null, locked_at = null
  where id = p_id and status = 'processing' and claim_token = p_claim_token;
  return found;
end;
$$;

create function public.admit_wall_text_daily_delivery(
  p_user_id text, p_business_profile_id uuid, p_business_profile_version integer,
  p_feed_id uuid, p_plan_id uuid, p_generator_version text, p_layout_version text,
  p_requested_count integer)
returns jsonb language plpgsql set search_path = '' as $$
declare
  v_feed public.daily_trending_feeds;
  v_plan public.wall_text_content_plans;
  v_intent public.wall_text_daily_delivery_intents;
  v_job public.background_jobs;
  v_slots uuid[];
  v_total integer;
  v_count integer;
  v_available integer;
  v_key text;
begin
  -- This lock serializes concurrent callers and reservations for the same profile.
  perform 1 from public.business_profiles where id = p_business_profile_id
    and user_id = p_user_id and profile_version = p_business_profile_version for update;
  if not found then raise exception 'wall_text_business_profile_changed'; end if;
  select * into v_feed from public.daily_trending_feeds where id = p_feed_id
    and user_id = p_user_id and business_profile_id = p_business_profile_id
    and business_profile_version = p_business_profile_version for update;
  if not found then raise exception 'wall_text_daily_delivery_feed_mismatch'; end if;
  select count(*) into v_total from public.daily_trending_feed_slots
    where feed_id = p_feed_id and format = 'wall_text';
  if v_total = 0 then return jsonb_build_object('kind', 'ready'); end if;
  select * into v_intent from public.wall_text_daily_delivery_intents
    where feed_id = p_feed_id and retry_key = coalesce(v_feed.wall_text_retry_key::text, '')
      and generator_version = p_generator_version and layout_version = p_layout_version
      and slot_count = v_total;
  if found then return jsonb_build_object('kind', 'job', 'jobId', v_intent.job_id); end if;
  if not exists (select 1 from public.wall_text_early_delivery_accounts
    where user_id = p_user_id and enabled) then
    return jsonb_build_object('kind', 'disabled');
  end if;
  -- A currently running writer owns its unfinished output, including during rollback
  -- or a daily-plan upgrade. Its completion callback will fill slots before retrying.
  select * into v_job from public.background_jobs j where j.user_id = p_user_id
    and j.job_type = 'wall_text_generation'
    and j.input_json ->> 'businessProfileId' = p_business_profile_id::text
    and j.input_json ->> 'businessProfileVersion' = p_business_profile_version::text
    and j.status in ('queued', 'processing', 'waiting_external_service', 'cancel_requested')
    order by j.created_at limit 1;
  if found then return jsonb_build_object('kind', 'job', 'jobId', v_job.id); end if;
  select array_agg(id order by position) into v_slots from public.daily_trending_feed_slots
    where feed_id = p_feed_id and format = 'wall_text'
      and state <> 'decided' and wall_text_assignment_id is null;
  v_count := least(coalesce(cardinality(v_slots), 0), p_requested_count);
  if v_count = 0 then return jsonb_build_object('kind', 'ready'); end if;
  if p_requested_count is null or p_requested_count not between 1 and 50 then
    raise exception 'wall_text_daily_delivery_count_invalid';
  end if;
  select * into v_plan from public.wall_text_content_plans p where p.id = p_plan_id
    and p.user_id = p_user_id and p.business_profile_id = p_business_profile_id
    and p.business_profile_version = p_business_profile_version
    and timezone(p.timezone, now())::date between p.period_start_date and p.period_end_date
    and p.status in ('generating', 'failed', 'active') for update;
  if not found then return jsonb_build_object('kind', 'planning'); end if;
  if not v_plan.early_delivery_enabled then return jsonb_build_object('kind', 'disabled'); end if;
  select count(*) into v_available from public.wall_text_content_plan_items i
    where i.plan_id = v_plan.id and i.status = 'available'
      and (v_plan.status = 'active' or (v_plan.early_delivery_enabled
        and i.sequence_index <= v_plan.published_item_count));
  if v_plan.status <> 'active' and v_available < v_count then
    return jsonb_build_object('kind', 'planning');
  end if;
  v_key := 'wall-text-daily:' || p_feed_id || ':retry-' || coalesce(v_feed.wall_text_retry_key::text, '')
    || ':slots-' || v_total || ':' || p_generator_version || ':' || p_layout_version;
  select * into v_job from jsonb_populate_record(null::public.background_jobs,
    public.create_or_get_background_job_v1(v_key, jsonb_build_object(
      'businessProfileId', p_business_profile_id, 'businessProfileVersion', p_business_profile_version,
      'userId', p_user_id, 'requestedCount', v_count, 'requestKey', v_key,
      'recoveryKey', coalesce(v_feed.wall_text_retry_key::text, p_feed_id::text),
      'earlyPlanId', v_plan.id, 'dailyFeedId', p_feed_id),
      'business_profile:' || p_business_profile_id || ':v' || p_business_profile_version,
      'wall_text_generation', 4, p_business_profile_id::text, 'ai-generation', p_user_id) -> 'job');
  insert into public.wall_text_daily_delivery_intents(feed_id, user_id, retry_key, generator_version, layout_version,
    slot_count, slot_ids, plan_id, job_id)
  values (p_feed_id, p_user_id, coalesce(v_feed.wall_text_retry_key::text, ''), p_generator_version, p_layout_version, v_total,
    v_slots[1:v_count], v_plan.id, v_job.id);
  return jsonb_build_object('kind', 'job', 'jobId', v_job.id);
end;
$$;

-- The old worker entry point cannot publish into an opted-in plan without fencing.
CREATE OR REPLACE FUNCTION public.persist_wall_text_content_plan_brief_chunk_unfenced(p_user_id text, p_plan_id uuid, p_briefs jsonb, p_items jsonb)
 RETURNS SETOF wall_text_content_plan_items
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_brief_count integer;
  v_existing_item_count integer;
  v_invalid_item_count integer;
  v_plan public.wall_text_content_plans%rowtype;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null
     or p_briefs is null
     or p_items is null
     or jsonb_typeof(p_briefs) <> 'array'
     or jsonb_typeof(p_items) <> 'array' then
    raise exception 'wall_text_content_plan_chunk_input_invalid';
  end if;

  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.status = 'generating'
  for update;
  if not found then
    raise exception 'wall_text_content_plan_not_generating';
  end if;

  select count(*)::integer into v_brief_count
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer, creative_seed text, audience_context text,
    human_moment text, emotional_tension text, supported_angle text,
    preferred_format_family text, brief_fingerprint text
  );
  if v_brief_count not between 1 and 5
     or jsonb_array_length(p_items) <> v_brief_count * 5 then
    raise exception 'wall_text_content_plan_chunk_shape_invalid';
  end if;

  select count(*)::integer into v_invalid_item_count
  from (
    select item.brief_index
    from jsonb_to_recordset(p_items) as item(
      brief_index integer, content_idea text, feeling text,
      sequence_index integer, idea_fingerprint text, private_context jsonb
    )
    group by item.brief_index
    having count(*) <> 5
  ) as invalid_items;

  if v_invalid_item_count <> 0 or exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      brief_index integer, content_idea text, feeling text,
      sequence_index integer, idea_fingerprint text, private_context jsonb
    )
    left join jsonb_to_recordset(p_briefs) as brief(
      brief_index integer, creative_seed text, audience_context text,
      human_moment text, emotional_tension text, supported_angle text,
      preferred_format_family text, brief_fingerprint text
    ) using (brief_index)
    where brief.brief_index is null
       or (item.private_context is not null
           and jsonb_typeof(item.private_context) <> 'object')
  ) then
    raise exception 'wall_text_content_plan_chunk_parent_invalid';
  end if;

  select count(*)::integer into v_existing_item_count
  from public.wall_text_content_plan_items as item
  where item.plan_id = p_plan_id;
  if v_existing_item_count + jsonb_array_length(p_items) > v_plan.target_item_count then
    raise exception 'wall_text_content_plan_chunk_exceeds_target';
  end if;

  insert into public.wall_text_content_plan_briefs (
    plan_id, user_id, brief_index, creative_seed, audience_context,
    human_moment, emotional_tension, supported_angle,
    preferred_format_family, brief_fingerprint
  )
  select
    p_plan_id, p_user_id, brief.brief_index, btrim(brief.creative_seed),
    btrim(brief.audience_context), btrim(brief.human_moment),
    btrim(brief.emotional_tension), btrim(brief.supported_angle),
    btrim(brief.preferred_format_family), btrim(brief.brief_fingerprint)
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer, creative_seed text, audience_context text,
    human_moment text, emotional_tension text, supported_angle text,
    preferred_format_family text, brief_fingerprint text
  );

  return query
  with inserted as (
    insert into public.wall_text_content_plan_items (
      plan_id, user_id, creative_brief_id, sequence_index, content_idea,
      feeling, idea_fingerprint, private_context, status
    )
    select
      p_plan_id, p_user_id, brief.id, item.sequence_index,
      btrim(item.content_idea), btrim(item.feeling),
      btrim(item.idea_fingerprint), item.private_context, 'available'
    from jsonb_to_recordset(p_items) as item(
      brief_index integer, content_idea text, feeling text,
      sequence_index integer, idea_fingerprint text, private_context jsonb
    )
    join public.wall_text_content_plan_briefs as brief
      on brief.plan_id = p_plan_id
      and brief.user_id = p_user_id
      and brief.brief_index = item.brief_index
    returning *
  )
  select * from inserted order by sequence_index;
end;
$function$
;
create or replace function public.persist_wall_text_content_plan_brief_chunk(
  p_user_id text, p_plan_id uuid, p_briefs jsonb, p_items jsonb)
returns setof public.wall_text_content_plan_items language plpgsql set search_path = '' as $$
begin
  perform 1 from public.wall_text_content_plans where id = p_plan_id for update;
  if exists (select 1 from public.wall_text_content_plans where id = p_plan_id and early_delivery_enabled) then
    raise exception 'wall_text_planner_upgrade_required';
  end if;
  return query select * from public.persist_wall_text_content_plan_brief_chunk_unfenced(p_user_id,p_plan_id,p_briefs,p_items);
end;
$$;

CREATE OR REPLACE FUNCTION public.reserve_wall_text_generation_batch_v1(p_user_id text, p_business_profile_id uuid, p_business_profile_version integer, p_request_key text, p_request_hash text, p_generator_version text, p_prompt_version text, p_format_library_version text, p_selector_version text, p_assignments jsonb)
 RETURNS SETOF wall_text_generation_batches
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  assignment_count integer;
  ordinary_assignment_count integer;
  batch_record public.wall_text_generation_batches;
  candidate_start integer;
  v_content_plan_id uuid;
  v_plan_item_ids uuid[];
  v_early_plan_id uuid;
  v_published_count integer;
  v_is_complete boolean;
begin
  perform public.assert_wall_text_generation_job_active(
    p_user_id, p_request_key, p_business_profile_id, p_business_profile_version
  );
  assignment_count := jsonb_array_length(p_assignments);
  if jsonb_typeof(p_assignments) <> 'array' or assignment_count < 1 or assignment_count > 50 then
    raise exception 'wall_text_batch_invalid_assignments';
  end if;

  select count(*) into ordinary_assignment_count
  from jsonb_array_elements(p_assignments) as item(value)
  where item.value ->> 'sourceKind' <> 'instagram_reel';

  perform 1 from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.profile_version = p_business_profile_version
  for update;
  if not found then
    raise exception 'wall_text_business_profile_changed';
  end if;

  select batch.* into batch_record
  from public.wall_text_generation_batches as batch
  where batch.user_id = p_user_id and batch.request_key = p_request_key;
  if found then
    if batch_record.request_hash <> p_request_hash then
      raise exception 'wall_text_batch_idempotency_mismatch';
    end if;
    return next batch_record;
    return;
  end if;

  if ordinary_assignment_count > 1 and exists (
    select 1 from jsonb_array_elements(p_assignments) as item
    where item ->> 'assignedFormatId' is not null and item ->> 'sourceKind' <> 'instagram_reel'
    group by item ->> 'assignedFormatId'
    having count(*) > floor(ordinary_assignment_count * 0.5)
  ) then
    raise exception 'wall_text_batch_format_share_exceeded';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' = 'instagram_reel'
      and not exists (
        select 1 from public.wall_text_instagram_reel_templates as template
        where template.id = nullif(item.value ->> 'instagramReelTemplateId', '')::uuid
          and template.status = 'active'
          and template.template_version = (item.value ->> 'instagramReelTemplateVersion')::integer
          and template.overlay_media_asset_id = (item.value ->> 'overlayMediaAssetId')::uuid
          and template.locked_audio_asset_id = item.value ->> 'instagramLockedAudioAssetId'
          and template.reference_text = item.value ->> 'instagramReferenceText'
          and template.reference_text_hash = item.value ->> 'instagramReferenceTextHash'
          and template.audio_fit_mode = item.value ->> 'instagramAudioFitMode'
          and template.writer_format_id = item.value ->> 'assignedFormatId'
          and abs((template.safe_text_box ->> 'x')::numeric - (item.value #>> '{layout,textBox,x}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'y')::numeric - (item.value #>> '{layout,textBox,y}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'width')::numeric - (item.value #>> '{layout,textBox,width}')::numeric) < 0.000001
          and abs((template.safe_text_box ->> 'height')::numeric - (item.value #>> '{layout,textBox,height}')::numeric) < 0.000001
      )
  ) then
    raise exception 'wall_text_instagram_reservation_mismatch';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_assignments) as item(value)
    where item.value ->> 'sourceKind' <> 'instagram_reel'
      and (item.value ->> 'instagramReelTemplateId' is not null
        or item.value ->> 'instagramReelTemplateVersion' is not null
        or item.value ->> 'instagramReferenceText' is not null
        or item.value ->> 'instagramReferenceTextHash' is not null
        or item.value ->> 'instagramLockedAudioAssetId' is not null
        or item.value ->> 'instagramAudioFitMode' is not null)
  ) then
    raise exception 'wall_text_non_instagram_snapshot_invalid';
  end if;

  select greatest(
    coalesce((select max(creative.candidate_index) + 1 from public.wall_text_creatives as creative
      where creative.user_id = p_user_id and creative.business_profile_id = p_business_profile_id
        and creative.business_profile_version = p_business_profile_version), 0),
    coalesce((select max(batch.candidate_index_start + batch.requested_count)
      from public.wall_text_generation_batches as batch
      where batch.user_id = p_user_id and batch.business_profile_id = p_business_profile_id
        and batch.business_profile_version = p_business_profile_version), 0)
  ) into candidate_start;

  -- Only an atomically admitted intent grants access to an incomplete plan.
  -- The grant survives disabling the rollout flag so queued jobs can finish.
  select intent.plan_id into v_early_plan_id
  from public.wall_text_daily_delivery_intents intent
  join public.background_jobs job on job.id = intent.job_id
  where intent.user_id = p_user_id and job.user_id = p_user_id
    and job.job_type = 'wall_text_generation'
    and job.input_json ->> 'requestKey' = p_request_key
    and job.input_json ->> 'earlyPlanId' = intent.plan_id::text;

  -- There is deliberately no direct-generation fallback. A pending plan is a
  -- durable planning dependency; an active plan is a rotating source pool.
  select plan.id, plan.published_item_count, plan.status = 'active'
    into v_content_plan_id, v_published_count, v_is_complete
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and (
      (v_early_plan_id is null and plan.status = 'active')
      or (plan.id = v_early_plan_id and (
        plan.status = 'active' or (plan.early_delivery_enabled
          and plan.status in ('generating', 'failed') and plan.published_item_count > 0)
      ))
    )
    and timezone(plan.timezone, timezone('utc', now()))::date
      between plan.period_start_date and plan.period_end_date
  order by plan.period_start_date desc, plan.plan_version desc
  limit 1
  for update;
  if not found then
    raise exception 'wall_text_content_plan_pending';
  end if;

  select array_agg(candidate.id order by candidate.fresh_rank, candidate.last_used_at nulls first, candidate.use_count, candidate.sequence_index)
  into v_plan_item_ids
  from (
    select item.id,
           case when item.status = 'available' then 0 else 1 end as fresh_rank,
           item.last_used_at, item.use_count, item.sequence_index
    from public.wall_text_content_plan_items as item
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and (v_is_complete or item.sequence_index <= v_published_count)
      and (
        item.status = 'available'
        or (
          v_is_complete and item.status = 'consumed'
          and not exists (
            select 1
            from public.wall_text_generation_assignments as prior_assignment
            join public.wall_text_generation_batches as prior_batch on prior_batch.id = prior_assignment.batch_id
            where prior_assignment.wall_text_content_plan_item_id = item.id
              and prior_batch.status in ('pending', 'processing')
          )
        )
      )
    order by case when item.status = 'available' then 0 else 1 end,
             item.last_used_at nulls first, item.use_count, item.sequence_index
    limit assignment_count
    for update of item skip locked
  ) as candidate;

  if coalesce(cardinality(v_plan_item_ids), 0) <> assignment_count then
    raise exception 'wall_text_content_plan_inventory_pending';
  end if;

  insert into public.wall_text_generation_batches (
    user_id, business_profile_id, business_profile_version, request_key,
    request_hash, requested_count, chunk_count, candidate_index_start,
    generator_version, prompt_version, format_library_version, selector_version
  ) values (
    p_user_id, p_business_profile_id, p_business_profile_version,
    btrim(p_request_key), p_request_hash, assignment_count,
    ceil(assignment_count / 10.0)::integer, candidate_start,
    p_generator_version, p_prompt_version, p_format_library_version, p_selector_version
  ) returning * into batch_record;

  insert into public.wall_text_generation_chunks (
    batch_id, chunk_index, first_batch_candidate_index, candidate_count,
    idempotency_key, request_hash
  )
  select batch_record.id, chunk_index, chunk_index * 10,
    least(10, assignment_count - chunk_index * 10),
    'wall-text-batch:' || batch_record.id::text || ':chunk:' || chunk_index::text,
    p_request_hash
  from generate_series(0, batch_record.chunk_count - 1) as chunk_index;

  insert into public.wall_text_generation_assignments (
    batch_id, chunk_id, batch_candidate_index, creative_candidate_index,
    assigned_format_id, format_library_version, selection_mode,
    selection_weight_snapshot, source_kind, overlay_media_asset_id,
    instagram_reel_template_id, instagram_reel_template_version,
    instagram_reference_text, instagram_reference_text_hash,
    instagram_locked_audio_asset_id, instagram_audio_fit_mode,
    duration_seconds, layout_json, target_words, max_words, focus_json,
    wall_text_content_plan_id, wall_text_content_plan_item_id
  )
  select
    batch_record.id, chunk.id, item.ordinality - 1,
    candidate_start + item.ordinality - 1, item.value ->> 'assignedFormatId',
    p_format_library_version, item.value ->> 'selectionMode',
    coalesce((item.value ->> 'selectionWeight')::numeric, 1),
    item.value ->> 'sourceKind', (item.value ->> 'overlayMediaAssetId')::uuid,
    nullif(item.value ->> 'instagramReelTemplateId', '')::uuid,
    nullif(item.value ->> 'instagramReelTemplateVersion', '')::integer,
    item.value ->> 'instagramReferenceText', item.value ->> 'instagramReferenceTextHash',
    item.value ->> 'instagramLockedAudioAssetId', item.value ->> 'instagramAudioFitMode',
    (item.value ->> 'durationSeconds')::numeric, item.value -> 'layout',
    (item.value ->> 'targetWords')::integer, (item.value ->> 'maxWords')::integer,
    coalesce(item.value -> 'focus', '{}'::jsonb), v_content_plan_id,
    planned_item.item_id
  from jsonb_array_elements(p_assignments) with ordinality as item(value, ordinality)
  join public.wall_text_generation_chunks as chunk
    on chunk.batch_id = batch_record.id
    and chunk.chunk_index = floor((item.ordinality - 1) / 10.0)::integer
  join unnest(v_plan_item_ids) with ordinality as planned_item(item_id, item_ordinal)
    on planned_item.item_ordinal = item.ordinality;

  update public.wall_text_content_plan_items as item
  set status = 'reserved', reserved_at = timezone('utc', now()), consumed_at = null,
      updated_at = timezone('utc', now())
  where item.plan_id = v_content_plan_id
    and item.user_id = p_user_id
    and item.id = any(v_plan_item_ids)
    and item.status in ('available', 'consumed');

  if (
    select count(*) from public.wall_text_content_plan_items as item
    where item.plan_id = v_content_plan_id
      and item.user_id = p_user_id
      and item.id = any(v_plan_item_ids)
      and item.status = 'reserved'
  ) <> assignment_count then
    raise exception 'wall_text_content_plan_reservation_incomplete';
  end if;

  return next batch_record;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.ensure_wall_text_content_plan(p_user_id text, p_project_id text, p_business_profile_id uuid, p_business_profile_version integer, p_timezone text, p_business_description text, p_planning_context jsonb, p_target_item_count integer, p_planner_model text, p_planner_prompt_version text)
 RETURNS wall_text_content_plans
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_current_date date;
  v_next_plan_version integer;
  v_now timestamptz := timezone('utc', now());
  v_owner_status text;
  v_plan public.wall_text_content_plans%rowtype;
  v_reopen_plan boolean := false;
begin
  if nullif(btrim(coalesce(p_user_id, '')), '') is null
     or nullif(btrim(coalesce(p_project_id, '')), '') is null
     or p_business_profile_id is null
     or p_business_profile_version is null
     or p_business_profile_version <= 0
     or nullif(btrim(coalesce(p_timezone, '')), '') is null
     or nullif(btrim(coalesce(p_business_description, '')), '') is null
     or char_length(btrim(p_business_description)) > 4000
     or p_planning_context is null
     or jsonb_typeof(p_planning_context) <> 'object'
     or p_target_item_count <> 200
     or nullif(btrim(coalesce(p_planner_model, '')), '') is null
     or nullif(btrim(coalesce(p_planner_prompt_version, '')), '') is null then
    raise exception 'wall_text_content_plan_ensure_input_invalid';
  end if;

  begin
    v_current_date := timezone(btrim(p_timezone), v_now)::date;
  exception
    when invalid_parameter_value then
      raise exception 'wall_text_content_plan_timezone_invalid';
  end;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'wall-text-content-plan:' || p_user_id || ':' || p_business_profile_id::text,
      819325101
    )
  );

  perform 1
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = p_project_id
    and profile.profile_version = p_business_profile_version
  for share;

  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  select plan.*
  into v_plan
  from public.wall_text_content_plans as plan
  where plan.user_id = p_user_id
    and plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.status in ('generating', 'active', 'failed')
    and v_current_date between plan.period_start_date and plan.period_end_date
  order by plan.period_start_date desc, plan.plan_version desc
  limit 1
  for update;

  if found then
    if v_plan.status = 'failed' then
      v_reopen_plan := true;
    elsif v_plan.status = 'generating'
      and v_plan.generation_job_id is not null then
      select job.status
      into v_owner_status
      from public.background_jobs as job
      where job.id = v_plan.generation_job_id;

      -- A failed or cancelled owner can no longer activate this plan. Do not
      -- return its stale ownership to the caller, or the next job will fail at
      -- the ownership-attachment guard.
      if v_owner_status in ('failed', 'cancelled') then
        v_reopen_plan := true;
      end if;
    end if;

    -- A partial plan remains useful after its bounded automatic resume budget.
    if v_reopen_plan and v_plan.early_delivery_enabled and v_plan.generation_attempt >= 3 then
      return v_plan;
    end if;

    if v_reopen_plan then
      update public.wall_text_content_plans as plan
      set
        status = 'generating',
        activated_at = null,
        failed_at = null,
        failure_reason = null,
        generation_attempt = plan.generation_attempt + 1,
        generation_completed_at = null,
        generation_job_id = null,
        generation_started_at = null,
        superseded_at = null,
        superseded_by_plan_id = null,
        updated_at = v_now
      where plan.id = v_plan.id
      returning plan.* into v_plan;
    end if;

    return v_plan;
  end if;

  select coalesce(max(plan.plan_version), 0) + 1
  into v_next_plan_version
  from public.wall_text_content_plans as plan
  where plan.business_profile_id = p_business_profile_id
    and plan.business_profile_version = p_business_profile_version
    and plan.period_start_date = v_current_date;

  insert into public.wall_text_content_plans (
    user_id, project_id, business_profile_id, business_profile_version,
    period_start_date, period_end_date, timezone, plan_version,
    business_description, planning_context, target_item_count,
    planner_model, planner_prompt_version
  ) values (
    p_user_id, p_project_id, p_business_profile_id, p_business_profile_version,
    v_current_date, v_current_date + 29, btrim(p_timezone), v_next_plan_version,
    btrim(p_business_description), p_planning_context, p_target_item_count,
    btrim(p_planner_model), btrim(p_planner_prompt_version)
  ) returning * into v_plan;

  return v_plan;
end;
$function$
;

-- Recovery is independent of empty daily-feed slots; already delivered posts do
-- not suppress completion of the remaining plan. ensure() caps automatic restarts.
create function public.list_wall_text_plans_needing_resume(p_limit integer default 10)
returns table(plan_id uuid, user_id text, business_profile_id uuid, business_profile_version integer)
language sql set search_path = '' as $$
  select p.id, p.user_id, p.business_profile_id, p.business_profile_version
  from public.wall_text_content_plans p
  join public.wall_text_early_delivery_accounts a on a.user_id = p.user_id and a.enabled
  join public.business_profiles b on b.id = p.business_profile_id and b.user_id = p.user_id
    and b.profile_version = p.business_profile_version
  left join public.background_jobs j on j.id = p.generation_job_id
  where p.early_delivery_enabled and p.status in ('generating', 'failed')
    and (p.generation_attempt < 3 or (p.status = 'generating' and p.generation_job_id is null))
    and timezone(p.timezone, now())::date between p.period_start_date and p.period_end_date
    and (p.generation_job_id is null or j.status in ('failed', 'cancelled'))
  order by p.updated_at limit greatest(1, least(coalesce(p_limit,10),25));
$$;

-- New functions are internal, use invoker rights, and have an empty search path.

CREATE OR REPLACE FUNCTION public.complete_wall_text_content_plan_generation_unfenced(p_user_id text, p_plan_id uuid, p_job_id uuid)
 RETURNS wall_text_content_plans
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_brief_count integer;
  v_invalid_item_count integer;
  v_item_count integer;
  v_plan public.wall_text_content_plans%rowtype;
begin
  select plan.* into v_plan
  from public.wall_text_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.generation_job_id = p_job_id
  for update;
  if not found then
    raise exception 'wall_text_content_plan_completion_mismatch';
  end if;
  if v_plan.status = 'active' then
    return v_plan;
  end if;
  if v_plan.status <> 'generating' then
    raise exception 'wall_text_content_plan_not_generating';
  end if;

  select count(*)::integer into v_brief_count
  from public.wall_text_content_plan_briefs as brief
  where brief.plan_id = p_plan_id and brief.user_id = p_user_id;
  select count(*)::integer into v_item_count
  from public.wall_text_content_plan_items as item
  where item.plan_id = p_plan_id and item.user_id = p_user_id;
  select count(*)::integer into v_invalid_item_count
  from (
    select item.creative_brief_id
    from public.wall_text_content_plan_items as item
    where item.plan_id = p_plan_id and item.user_id = p_user_id
    group by item.creative_brief_id
    having count(*) <> 5
  ) as invalid_items;
  if v_brief_count <> 40
     or v_item_count <> v_plan.target_item_count
     or v_invalid_item_count <> 0 then
    raise exception 'wall_text_content_plan_incomplete';
  end if;

  update public.wall_text_content_plans as prior_plan
  set
    status = 'superseded',
    superseded_at = timezone('utc', now()),
    superseded_by_plan_id = p_plan_id,
    updated_at = timezone('utc', now())
  where prior_plan.user_id = p_user_id
    and prior_plan.business_profile_id = v_plan.business_profile_id
    and prior_plan.id <> p_plan_id
    and prior_plan.status = 'active';

  update public.wall_text_content_plans as plan
  set
    status = 'active',
    activated_at = timezone('utc', now()),
    generation_completed_at = timezone('utc', now()),
    updated_at = timezone('utc', now())
  where plan.id = p_plan_id
  returning plan.* into v_plan;
  return v_plan;
end;
$function$
;
create or replace function public.complete_wall_text_content_plan_generation(p_user_id text, p_plan_id uuid, p_job_id uuid)
returns public.wall_text_content_plans language plpgsql set search_path = '' as $$
begin
  perform 1 from public.wall_text_content_plans where id = p_plan_id for update;
  if exists (select 1 from public.wall_text_content_plans where id = p_plan_id and early_delivery_enabled) then
    raise exception 'wall_text_planner_upgrade_required';
  end if;
  return public.complete_wall_text_content_plan_generation_unfenced(p_user_id,p_plan_id,p_job_id);
end;
$$;
revoke all on function public.initialize_wall_text_early_delivery() from public, anon, authenticated;
grant execute on function public.initialize_wall_text_early_delivery() to service_role;
revoke all on function public.assert_wall_text_planner_claim(text,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.assert_wall_text_planner_claim(text,uuid,uuid,uuid) to service_role;
revoke all on function public.persist_wall_text_content_plan_brief_chunk_v2(text,uuid,uuid,uuid,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.persist_wall_text_content_plan_brief_chunk_v2(text,uuid,uuid,uuid,integer,jsonb,jsonb) to service_role;
revoke all on function public.persist_wall_text_content_plan_brief_chunk_unfenced(text,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.persist_wall_text_content_plan_brief_chunk_unfenced(text,uuid,jsonb,jsonb) to service_role;
revoke all on function public.persist_wall_text_content_plan_brief_chunk(text,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.persist_wall_text_content_plan_brief_chunk(text,uuid,jsonb,jsonb) to service_role;
revoke all on function public.complete_wall_text_content_plan_generation_v2(text,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.complete_wall_text_content_plan_generation_v2(text,uuid,uuid,uuid) to service_role;
revoke all on function public.complete_wall_text_content_plan_generation_unfenced(text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.complete_wall_text_content_plan_generation_unfenced(text,uuid,uuid) to service_role;
revoke all on function public.complete_wall_text_content_plan_generation(text,uuid,uuid) from public, anon, authenticated;
grant execute on function public.complete_wall_text_content_plan_generation(text,uuid,uuid) to service_role;
revoke all on function public.claim_wall_text_plan_publications(integer,uuid) from public, anon, authenticated;
grant execute on function public.claim_wall_text_plan_publications(integer,uuid) to service_role;
revoke all on function public.finish_wall_text_plan_publication(uuid,uuid,text) from public, anon, authenticated;
grant execute on function public.finish_wall_text_plan_publication(uuid,uuid,text) to service_role;
revoke all on function public.admit_wall_text_daily_delivery(text,uuid,integer,uuid,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.admit_wall_text_daily_delivery(text,uuid,integer,uuid,uuid,text,text,integer) to service_role;
revoke all on function public.list_wall_text_plans_needing_resume(integer) from public, anon, authenticated;
grant execute on function public.list_wall_text_plans_needing_resume(integer) to service_role;

-- Match the job -> plan lock order used by chunk commits and terminalization.
create or replace function public.attach_wall_text_content_plan_generation_job(
  p_user_id text, p_plan_id uuid, p_job_id uuid)
returns public.wall_text_content_plans language plpgsql set search_path = '' as $$
declare v_plan public.wall_text_content_plans;
begin
  perform 1 from public.background_jobs j where j.id = p_job_id and j.user_id = p_user_id
    and j.job_type = 'wall_text_content_plan_generation' and j.input_json ->> 'planId' = p_plan_id::text
  for share;
  if not found then raise exception 'wall_text_content_plan_generation_job_mismatch'; end if;
  select * into v_plan from public.wall_text_content_plans p
    where p.id = p_plan_id and p.user_id = p_user_id and p.status = 'generating' for update;
  if not found then raise exception 'wall_text_content_plan_not_generating'; end if;
  if v_plan.generation_job_id is not null and v_plan.generation_job_id <> p_job_id then
    raise exception 'wall_text_content_plan_generation_job_conflict';
  end if;
  update public.wall_text_content_plans set generation_job_id = p_job_id,
    generation_started_at = coalesce(generation_started_at, now()), updated_at = now()
    where id = p_plan_id returning * into v_plan;
  return v_plan;
end;
$$;
