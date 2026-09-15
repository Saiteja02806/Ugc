-- Reaction V2 adds backend-owned fact grounding without invalidating any
-- existing V1 job. New jobs carry an immutable fact snapshot derived from the
-- exact business_profile version; old in-flight jobs retain their V1 context.

-- This normalizer is deliberately separate from reaction_context_string_list_v1.
-- V1 contexts must retain their existing canonical form so pre-release jobs
-- remain valid. Keep the whitespace set and 360-character rule in sync with
-- lib/business-profiles/fact-catalog.ts. U& makes the ECMAScript whitespace
-- code points explicit instead of depending on the database locale.
create or replace function public.reaction_business_fact_text_v1(p_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(
    left(
      btrim(regexp_replace(
        coalesce(p_value, ''),
        U&'[\0009-\000D\0020\00A0\1680\2000-\200A\2028\2029\202F\205F\3000\FEFF]+',
        ' ',
        'g'
      )),
      360
    ),
    ''
  );
$$;

create or replace function public.reaction_business_fact_string_list_v1(p_values jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  with raw_values as (
    select item.value, item.ordinality
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(p_values) = 'array' then p_values
        else '[]'::jsonb
      end
    ) with ordinality as item(value, ordinality)
  ), normalized as (
    select public.reaction_business_fact_text_v1(value) as value, ordinality
    from raw_values
  ), deduplicated as (
    select value, min(ordinality) as first_index
    from normalized
    where value is not null
    group by value
    order by min(ordinality)
    limit 6
  )
  select coalesce(
    jsonb_agg(value order by first_index),
    '[]'::jsonb
  )
  from deduplicated;
$$;

create or replace function public.reaction_business_fact_snapshot_v1(p_context jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  with raw_facts as (
    select 'capability'::text as fact_type, p_context->>'productSummary' as value, 1::integer as source_order
    union all
    select 'capability', item.value, 100 + item.ordinality::integer
    from jsonb_array_elements_text(case when jsonb_typeof(p_context->'valueProps') = 'array' then p_context->'valueProps' else '[]'::jsonb end)
      with ordinality as item(value, ordinality)
    union all
    select 'differentiator', item.value, 200 + item.ordinality::integer
    from jsonb_array_elements_text(case when jsonb_typeof(p_context->'differentiators') = 'array' then p_context->'differentiators' else '[]'::jsonb end)
      with ordinality as item(value, ordinality)
    union all
    select 'pain', p_context->>'mainProblem', 300
    union all
    select 'pain', item.value, 301 + item.ordinality::integer
    from jsonb_array_elements_text(case when jsonb_typeof(p_context->'painPoints') = 'array' then p_context->'painPoints' else '[]'::jsonb end)
      with ordinality as item(value, ordinality)
    union all
    select 'outcome', p_context->>'mainPromise', 400
    union all
    select 'audience', item.value, 500 + item.ordinality::integer
    from jsonb_array_elements_text(case when jsonb_typeof(p_context->'targetAudience') = 'array' then p_context->'targetAudience' else '[]'::jsonb end)
      with ordinality as item(value, ordinality)
  ), cleaned as (
    select
      fact_type,
      public.reaction_business_fact_text_v1(value) as text,
      source_order,
      row_number() over (partition by fact_type order by source_order) as fact_number
    from raw_facts
    where public.reaction_business_fact_text_v1(value) is not null
  ), limited as (
    select * from cleaned order by source_order limit 12
  )
  select jsonb_build_object(
    'version', 'business-facts-v1',
    'claimsToAvoid', public.reaction_business_fact_string_list_v1(
      case when jsonb_typeof(p_context->'claimsToAvoid') = 'array'
        then p_context->'claimsToAvoid' else '[]'::jsonb end
    ),
    'facts', coalesce(
      (select jsonb_agg(
        jsonb_build_object(
          'id', fact_type || '-' || fact_number::text,
          'text', text,
          'type', fact_type
        ) order by source_order
      ) from limited),
      '[]'::jsonb
    )
  );
$$;

create or replace function public.reaction_generation_context_v2(p_context jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
    'contextVersion', 'reaction-grounding-v2',
    'audience', public.reaction_context_string_list_v1(
      (case when jsonb_typeof(p_context->'targetAudience') = 'array'
        then p_context->'targetAudience' else '[]'::jsonb end)
      || (case when jsonb_typeof(p_context->'categories') = 'array'
        then p_context->'categories' else '[]'::jsonb end)
      || jsonb_build_array(p_context->>'category')
    ),
    'commonSituations', public.reaction_context_string_list_v1(
      (case when jsonb_typeof(p_context->'painPoints') = 'array'
        then p_context->'painPoints' else '[]'::jsonb end)
      || jsonb_build_array(p_context->>'mainProblem')
    ),
    'desiredOutcomes', public.reaction_context_string_list_v1(
      (case when jsonb_typeof(p_context->'valueProps') = 'array'
        then p_context->'valueProps' else '[]'::jsonb end)
      || jsonb_build_array(p_context->>'mainPromise')
    ),
    'factSnapshot', public.reaction_business_fact_snapshot_v1(p_context),
    'pains', public.reaction_context_string_list_v1(
      (case when jsonb_typeof(p_context->'painPoints') = 'array'
        then p_context->'painPoints' else '[]'::jsonb end)
      || jsonb_build_array(p_context->>'productSummary')
    ),
    'productName', nullif(left(btrim(coalesce(p_context->>'businessName', '')), 160), '')
  );
$$;

-- Keep one trigger/function name for rolling deployment. V1 payloads remain
-- canonical for pre-release jobs; V2 is mandatory only when it identifies
-- itself explicitly. A malformed/unknown version fails closed.
create or replace function public.validate_reaction_generation_background_job_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_record public.business_profiles;
  canonical_context jsonb;
  input_profile_version integer;
  context_version text;
begin
  if new.job_type <> 'reaction_generation' then
    return new;
  end if;

  if new.user_id is null or btrim(new.user_id) = ''
    or new.project_id is null or btrim(new.project_id) = ''
    or new.input_json->>'userId' is distinct from new.user_id
    or new.input_json->>'projectId' is distinct from new.project_id
    or nullif(btrim(new.input_json->>'businessProfileId'), '') is null
    or not (coalesce(new.input_json->>'businessProfileVersion', '') ~ '^[0-9]+$')
  then
    raise exception 'reaction_generation_profile_mismatch';
  end if;

  begin
    input_profile_version := (new.input_json->>'businessProfileVersion')::integer;
  exception when others then
    raise exception 'reaction_generation_profile_mismatch';
  end;

  select profile.* into profile_record
  from public.business_profiles as profile
  where profile.id::text = new.input_json->>'businessProfileId'
    and profile.user_id = new.user_id
    and profile.project_id = new.project_id
    and profile.profile_version = input_profile_version;
  if not found then
    raise exception 'reaction_generation_profile_mismatch';
  end if;

  if coalesce(new.input_json->>'generationOrigin', 'business_generation') <> 'business_generation' then
    raise exception 'reaction_generation_origin_invalid';
  end if;

  context_version := new.input_json->'generationContext'->>'contextVersion';
  if context_version is null then
    canonical_context := public.reaction_generation_context_v1(profile_record.context_json);
  elsif context_version = 'reaction-grounding-v2' then
    canonical_context := public.reaction_generation_context_v2(profile_record.context_json);
  else
    raise exception 'reaction_generation_context_version_invalid';
  end if;

  if new.input_json->'generationContext' is distinct from canonical_context then
    raise exception 'reaction_generation_context_mismatch';
  end if;

  return new;
end;
$$;

create or replace function public.ensure_reaction_generation_run_v1(
  p_generation_job_id uuid,
  p_user_id text,
  p_business_profile_id uuid,
  p_business_profile_version integer,
  p_project_id text,
  p_request_key text,
  p_requested_count integer,
  p_generation_context jsonb
)
returns setof public.reaction_generation_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  run_record public.reaction_generation_runs;
  job_record public.background_jobs;
  profile_record public.business_profiles;
  canonical_context jsonb;
  context_version text;
begin
  if p_generation_job_id is null
    or p_user_id is null or btrim(p_user_id) = ''
    or p_business_profile_id is null
    or p_business_profile_version is null or p_business_profile_version < 1
    or p_request_key is null or btrim(p_request_key) = ''
    or p_project_id is null or btrim(p_project_id) = ''
    or p_requested_count is null or p_requested_count not between 1 and 12
    or jsonb_typeof(p_generation_context) is distinct from 'object'
  then
    raise exception 'reaction_generation_request_invalid';
  end if;

  select job.* into job_record
  from public.background_jobs as job
  where job.id = p_generation_job_id
    and job.job_type = 'reaction_generation'
    and job.user_id = p_user_id
    and job.project_id = p_project_id;
  if not found then
    raise exception 'reaction_generation_job_mismatch';
  end if;

  if job_record.input_json->>'userId' is distinct from p_user_id
    or job_record.input_json->>'projectId' is distinct from p_project_id
    or job_record.input_json->>'businessProfileId' is distinct from p_business_profile_id::text
    or job_record.input_json->>'businessProfileVersion' is distinct from p_business_profile_version::text
    or job_record.input_json->>'requestKey' is distinct from p_request_key
    or coalesce(job_record.input_json->>'generationOrigin', 'business_generation') <> 'business_generation'
  then
    raise exception 'reaction_generation_job_mismatch';
  end if;

  select profile.* into profile_record
  from public.business_profiles as profile
  where profile.id = p_business_profile_id
    and profile.user_id = p_user_id
    and profile.project_id = p_project_id
    and profile.profile_version = p_business_profile_version;
  if not found then
    raise exception 'reaction_generation_profile_mismatch';
  end if;

  context_version := p_generation_context->>'contextVersion';
  if context_version is null then
    canonical_context := public.reaction_generation_context_v1(profile_record.context_json);
  elsif context_version = 'reaction-grounding-v2' then
    canonical_context := public.reaction_generation_context_v2(profile_record.context_json);
  else
    raise exception 'reaction_generation_context_version_invalid';
  end if;

  if p_generation_context is distinct from canonical_context
    or job_record.input_json->'generationContext' is distinct from canonical_context
  then
    raise exception 'reaction_generation_context_mismatch';
  end if;

  insert into public.reaction_generation_runs (
    generation_job_id, user_id, business_profile_id, business_profile_version,
    project_id, request_key, requested_count, generation_context,
    generation_origin, status
  ) values (
    p_generation_job_id, p_user_id, p_business_profile_id, p_business_profile_version,
    p_project_id, p_request_key, p_requested_count, canonical_context,
    'business_generation', 'queued'
  )
  on conflict (user_id, request_key) do nothing;

  select run.* into run_record
  from public.reaction_generation_runs as run
  where run.user_id = p_user_id and run.request_key = p_request_key
  for update;

  if run_record.id is null
    or run_record.generation_job_id <> p_generation_job_id
    or run_record.business_profile_id <> p_business_profile_id
    or run_record.business_profile_version <> p_business_profile_version
    or run_record.project_id <> p_project_id
    or run_record.requested_count <> p_requested_count
    or run_record.generation_origin <> 'business_generation'
    or run_record.generation_context is distinct from canonical_context
  then
    raise exception 'reaction_generation_request_conflict';
  end if;

  if run_record.status = 'queued' then
    update public.reaction_generation_runs
    set status = 'planning', failure_message = null
    where id = run_record.id;
  end if;

  return query
  select run.* from public.reaction_generation_runs as run where run.id = run_record.id;
end;
$$;

revoke all on function public.reaction_business_fact_snapshot_v1(jsonb) from public, anon, authenticated;
revoke all on function public.reaction_generation_context_v2(jsonb) from public, anon, authenticated;
revoke all on function public.reaction_business_fact_text_v1(text) from public, anon, authenticated;
revoke all on function public.reaction_business_fact_string_list_v1(jsonb) from public, anon, authenticated;
grant execute on function public.reaction_business_fact_snapshot_v1(jsonb) to service_role;
grant execute on function public.reaction_generation_context_v2(jsonb) to service_role;
grant execute on function public.reaction_business_fact_text_v1(text) to service_role;
grant execute on function public.reaction_business_fact_string_list_v1(jsonb) to service_role;

select pg_notify('pgrst', 'reload schema');
