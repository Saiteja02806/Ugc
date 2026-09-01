-- New plans keep the existing five-item parent brief, while every item now
-- carries the exact private context its writer must use. NULL keeps all plans
-- created before this migration fully compatible with the shared-brief path.
ALTER TABLE public.carousel_content_plan_items
  ADD COLUMN IF NOT EXISTS private_context jsonb;

ALTER TABLE public.wall_text_content_plan_items
  ADD COLUMN IF NOT EXISTS private_context jsonb;

ALTER TABLE public.carousel_content_plan_items
  ADD CONSTRAINT carousel_content_plan_items_private_context_object_check
  CHECK (private_context IS NULL OR jsonb_typeof(private_context) = 'object')
  NOT VALID;

ALTER TABLE public.wall_text_content_plan_items
  ADD CONSTRAINT wall_text_content_plan_items_private_context_object_check
  CHECK (private_context IS NULL OR jsonb_typeof(private_context) = 'object')
  NOT VALID;

ALTER TABLE public.carousel_content_plan_items
  VALIDATE CONSTRAINT carousel_content_plan_items_private_context_object_check;

ALTER TABLE public.wall_text_content_plan_items
  VALIDATE CONSTRAINT wall_text_content_plan_items_private_context_object_check;

CREATE OR REPLACE FUNCTION public.persist_carousel_content_plan_brief_chunk (
  p_user_id text,
  p_plan_id uuid,
  p_briefs  jsonb,
  p_items   jsonb
)
  RETURNS SETOF public.carousel_content_plan_items
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  v_brief_count integer;
  v_invalid_item_count integer;
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null
     or p_plan_id is null
     or p_briefs is null
     or p_items is null
     or jsonb_typeof(p_briefs) <> 'array'
     or jsonb_typeof(p_items) <> 'array' then
    raise exception 'carousel_content_plan_brief_chunk_input_invalid';
  end if;

  select plan.* into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id
    and plan.user_id = p_user_id
    and plan.status = 'generating'
  for update;
  if not found then
    raise exception 'carousel_content_plan_brief_chunk_plan_not_generating';
  end if;

  select count(*)::integer into v_brief_count
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer, creative_seed text, audience_context text,
    human_moment text, emotional_tension text, supported_angle text,
    preferred_format_family text, brief_fingerprint text
  );
  if v_brief_count not between 1 and 5
     or jsonb_array_length(p_items) <> v_brief_count * 5 then
    raise exception 'carousel_content_plan_brief_chunk_shape_invalid';
  end if;

  select count(*)::integer into v_invalid_item_count
  from (
    select item.brief_index
    from jsonb_to_recordset(p_items) as item(
      brief_index integer, creative_seed text, emotion text,
      sequence_index integer, day_number integer, day_slot_index integer,
      seed_fingerprint text, private_context jsonb
    )
    group by item.brief_index
    having count(*) <> 5
  ) as invalid_items;
  if v_invalid_item_count <> 0 then
    raise exception 'carousel_content_plan_brief_chunk_item_balance_invalid';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(
      brief_index integer, creative_seed text, emotion text,
      sequence_index integer, day_number integer, day_slot_index integer,
      seed_fingerprint text, private_context jsonb
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
    raise exception 'carousel_content_plan_brief_chunk_item_parent_missing';
  end if;

  insert into public.carousel_content_plan_briefs (
    plan_id, user_id, brief_index, creative_seed, audience_context,
    human_moment, emotional_tension, supported_angle,
    preferred_format_family, brief_fingerprint
  )
  select
    p_plan_id, p_user_id, brief.brief_index, trim(brief.creative_seed),
    trim(brief.audience_context), trim(brief.human_moment),
    trim(brief.emotional_tension), trim(brief.supported_angle),
    trim(brief.preferred_format_family), trim(brief.brief_fingerprint)
  from jsonb_to_recordset(p_briefs) as brief(
    brief_index integer, creative_seed text, audience_context text,
    human_moment text, emotional_tension text, supported_angle text,
    preferred_format_family text, brief_fingerprint text
  );

  return query
  with inserted as (
    insert into public.carousel_content_plan_items (
      plan_id, user_id, creative_brief_id, sequence_index, day_number,
      day_slot_index, creative_seed, emotion, seed_fingerprint,
      private_context, status
    )
    select
      p_plan_id, p_user_id, brief.id, item.sequence_index, item.day_number,
      item.day_slot_index, trim(item.creative_seed), trim(item.emotion),
      trim(item.seed_fingerprint), item.private_context, 'planned'
    from jsonb_to_recordset(p_items) as item(
      brief_index integer, creative_seed text, emotion text,
      sequence_index integer, day_number integer, day_slot_index integer,
      seed_fingerprint text, private_context jsonb
    )
    join public.carousel_content_plan_briefs as brief
      on brief.plan_id = p_plan_id
      and brief.user_id = p_user_id
      and brief.brief_index = item.brief_index
    returning *
  )
  select * from inserted order by sequence_index;
end;
$function$;

GRANT EXECUTE ON FUNCTION public.persist_carousel_content_plan_brief_chunk(text, uuid, jsonb, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.persist_carousel_content_plan_brief_chunk(text, uuid, jsonb, jsonb)
  FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.persist_wall_text_content_plan_brief_chunk (
  p_user_id text,
  p_plan_id uuid,
  p_briefs  jsonb,
  p_items   jsonb
)
  RETURNS SETOF public.wall_text_content_plan_items
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
$function$;

GRANT EXECUTE ON FUNCTION public.persist_wall_text_content_plan_brief_chunk(text, uuid, jsonb, jsonb)
  TO postgres, service_role;
REVOKE ALL ON FUNCTION public.persist_wall_text_content_plan_brief_chunk(text, uuid, jsonb, jsonb)
  FROM PUBLIC;

-- Keep the activation guard in step with the new persisted item-context
-- prompt version. The existing versions remain valid for previously-created
-- plans, and the 30 parent-brief / five-items-per-brief invariant is unchanged.
CREATE OR REPLACE FUNCTION public.activate_carousel_content_plan (
  p_user_id text,
  p_plan_id uuid
)
  RETURNS public.carousel_content_plans
  LANGUAGE plpgsql
  SET search_path TO ''
AS $function$
declare
  v_brief_count integer;
  v_invalid_brief_item_count integer;
  v_item_count integer;
  v_minimum_day_count integer;
  v_now timestamptz := timezone('utc', now());
  v_plan public.carousel_content_plans%rowtype;
begin
  if nullif(trim(coalesce(p_user_id, '')), '') is null or p_plan_id is null then
    raise exception 'carousel_content_plan_activation_input_invalid';
  end if;

  select plan.* into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id and plan.user_id = p_user_id;
  if not found then
    raise exception 'carousel_content_plan_not_found';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      'carousel-content-plan:' || p_user_id || ':' || v_plan.business_profile_id::text,
      641902731
    )
  );

  select plan.* into v_plan
  from public.carousel_content_plans as plan
  where plan.id = p_plan_id and plan.user_id = p_user_id
  for update;
  if v_plan.status = 'active' then return v_plan; end if;
  if v_plan.status <> 'generating' then
    raise exception 'carousel_content_plan_not_activatable';
  end if;

  perform 1
  from public.business_profiles as profile
  where profile.id = v_plan.business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = v_plan.project_id
    and profile.profile_version = v_plan.business_profile_version
  for share;
  if not found then
    raise exception 'business_profile_version_changed';
  end if;

  if timezone(v_plan.timezone, v_now)::date
       not between v_plan.period_start_date and v_plan.period_end_date then
    raise exception 'carousel_content_plan_period_not_current';
  end if;

  select count(*)::integer into v_item_count
  from public.carousel_content_plan_items as item
  where item.plan_id = v_plan.id and item.user_id = p_user_id and item.status = 'planned';

  select min(day_items.item_count)::integer into v_minimum_day_count
  from (
    select item.day_number, count(*)::integer as item_count
    from public.carousel_content_plan_items as item
    where item.plan_id = v_plan.id and item.user_id = p_user_id and item.status = 'planned'
    group by item.day_number
  ) as day_items;

  if v_item_count < v_plan.target_item_count
     or (
       select count(distinct item.day_number)
       from public.carousel_content_plan_items as item
       where item.plan_id = v_plan.id and item.user_id = p_user_id and item.status = 'planned'
     ) <> 30
     or coalesce(v_minimum_day_count, 0) < 5 then
    raise exception 'carousel_content_plan_incomplete';
  end if;

  if v_plan.planner_prompt_version in (
    'carousel-content-plan-creative-briefs-v2',
    'carousel-content-plan-creative-briefs-v3-explicit-definitions',
    'carousel-content-plan-creative-briefs-v4-diverse-cycle-history',
    'carousel-content-plan-creative-briefs-v5-broad-cycle-history',
    'carousel-content-plan-creative-briefs-v6-item-context-concept-lanes'
  ) then
    select count(*)::integer into v_brief_count
    from public.carousel_content_plan_briefs as brief
    where brief.plan_id = v_plan.id and brief.user_id = p_user_id;

    select count(*)::integer into v_invalid_brief_item_count
    from (
      select item.creative_brief_id
      from public.carousel_content_plan_items as item
      where item.plan_id = v_plan.id and item.user_id = p_user_id and item.status = 'planned'
      group by item.creative_brief_id
      having item.creative_brief_id is null or count(*) <> 5
    ) as invalid_brief_items;

    if v_brief_count <> 30 or v_invalid_brief_item_count <> 0 then
      raise exception 'carousel_content_plan_creative_briefs_incomplete';
    end if;
  end if;

  update public.carousel_content_plans as prior_plan
  set status = 'superseded', superseded_at = v_now,
      superseded_by_plan_id = v_plan.id, updated_at = v_now
  where prior_plan.user_id = p_user_id
    and prior_plan.business_profile_id = v_plan.business_profile_id
    and prior_plan.id <> v_plan.id
    and prior_plan.status = 'active';

  update public.carousel_content_plan_items as item
  set status = 'available', updated_at = v_now
  where item.plan_id = v_plan.id and item.user_id = p_user_id and item.status = 'planned';

  update public.carousel_content_plans as plan
  set activated_at = v_now, status = 'active', updated_at = v_now
  where plan.id = v_plan.id
  returning plan.* into v_plan;
  return v_plan;
end;
$function$;

COMMENT ON FUNCTION public.activate_carousel_content_plan(text, uuid)
  IS 'Activates a complete current 30-day plan, including the item-level creative-context contract.';
