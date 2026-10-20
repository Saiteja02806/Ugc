-- Reaction generation must be tied to the exact business profile context that
-- owns the job.  This closes the path used by the isolated Canary QA runner,
-- which supplied office captions while storing them under the meal-logging
-- profile.

alter table public.reaction_generation_runs
  add column if not exists generation_origin text not null default 'business_generation';
alter table public.reaction_generation_runs
  drop constraint if exists reaction_generation_runs_origin_chk;
alter table public.reaction_generation_runs
  add constraint reaction_generation_runs_origin_chk check (
    generation_origin in ('business_generation', 'internal_qa')
  );

alter table public.reaction_creatives
  add column if not exists generation_origin text not null default 'business_generation';
alter table public.reaction_creatives
  drop constraint if exists reaction_creatives_origin_chk;
alter table public.reaction_creatives
  add constraint reaction_creatives_origin_chk check (
    generation_origin in ('business_generation', 'internal_qa')
  );

create or replace function public.reaction_context_string_list_v1(p_values jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(
    jsonb_agg(normalized.value order by normalized.first_index),
    '[]'::jsonb
  )
  from (
    select btrim(item.value) as value, min(item.ordinality) as first_index
    from jsonb_array_elements_text(
      case
        when jsonb_typeof(p_values) = 'array' then p_values
        else '[]'::jsonb
      end
    ) with ordinality as item(value, ordinality)
    where nullif(btrim(item.value), '') is not null
    group by btrim(item.value)
    order by min(item.ordinality)
    limit 12
  ) as normalized;
$$;

create or replace function public.reaction_generation_context_v1(p_context jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select jsonb_build_object(
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
    'pains', public.reaction_context_string_list_v1(
      (case when jsonb_typeof(p_context->'painPoints') = 'array'
        then p_context->'painPoints' else '[]'::jsonb end)
      || jsonb_build_array(p_context->>'productSummary')
    ),
    'productName', nullif(left(btrim(coalesce(p_context->>'businessName', '')), 160), '')
  );
$$;

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

  canonical_context := public.reaction_generation_context_v1(profile_record.context_json);
  if new.input_json->'generationContext' is distinct from canonical_context then
    raise exception 'reaction_generation_context_mismatch';
  end if;

  return new;
end;
$$;

create or replace function public.validate_reaction_creative_origin_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  run_origin text;
begin
  if new.render_job_id is null then
    return new;
  end if;

  select run.generation_origin into run_origin
  from public.reaction_generation_runs as run
  where run.generation_job_id = new.render_job_id;

  if tg_op = 'INSERT' and not found and new.generation_origin = 'business_generation' then
    raise exception 'reaction_generation_creative_run_required';
  end if;

  if found and new.generation_origin is distinct from run_origin then
    raise exception 'reaction_generation_origin_mismatch';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reaction_creative_origin on public.reaction_creatives;
create trigger validate_reaction_creative_origin
  before insert or update of render_job_id, generation_origin
  on public.reaction_creatives
  for each row execute function public.validate_reaction_creative_origin_v1();

create or replace function public.validate_reaction_generation_plan_provenance_v1()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.generation_origin <> 'business_generation' or new.brief_payload is null then
    return new;
  end if;

  if jsonb_typeof(new.brief_payload) is distinct from 'object'
    or jsonb_typeof(new.brief_payload->'briefs') is distinct from 'array'
    or jsonb_array_length(new.brief_payload->'briefs') < 1
    or jsonb_typeof(new.brief_payload->'availability') is distinct from 'object'
    or jsonb_typeof(new.brief_payload->'promptVersion') is distinct from 'string'
    or jsonb_typeof(new.brief_payload->'selectionVersion') is distinct from 'string'
    or jsonb_typeof(new.brief_payload->'shortfallCount') is distinct from 'number'
  then
    raise exception 'reaction_generation_plan_provenance_invalid';
  end if;

  return new;
end;
$$;

drop trigger if exists validate_reaction_generation_plan_provenance on public.reaction_generation_runs;
create trigger validate_reaction_generation_plan_provenance
  before insert or update of brief_payload, generation_origin
  on public.reaction_generation_runs
  for each row execute function public.validate_reaction_generation_plan_provenance_v1();

drop trigger if exists validate_reaction_generation_background_job on public.background_jobs;
create trigger validate_reaction_generation_background_job
  before insert or update of user_id, project_id, job_type, input_json
  on public.background_jobs
  for each row execute function public.validate_reaction_generation_background_job_v1();

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

  canonical_context := public.reaction_generation_context_v1(profile_record.context_json);
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

-- The previous Canary batch is retained for auditability but can no longer
-- appear in Trending or reserve clips for a real business generation.
update public.reaction_generation_runs as run
set generation_origin = 'internal_qa'
where run.user_id = 'hook-v6-locked-canary'
  and run.request_key like 'reaction-library-20260909:%';

update public.reaction_creatives as creative
set generation_origin = 'internal_qa'
from public.reaction_generation_run_items as item
join public.reaction_generation_runs as run
  on run.id = item.generation_run_id
where item.reaction_creative_id = creative.id
  and run.generation_origin = 'internal_qa';

update public.user_reaction_assignments as assignment
set state = 'completed_skipped', completed_at = coalesce(assignment.completed_at, now())
from public.reaction_generation_run_items as item
join public.reaction_generation_runs as run
  on run.id = item.generation_run_id
where assignment.id = item.reaction_assignment_id
  and run.generation_origin = 'internal_qa'
  and assignment.state = 'active';

-- These helpers are internal worker APIs. Supabase default privileges can
-- grant anon/authenticated directly, so revoking PUBLIC alone is insufficient.
revoke all on function public.reaction_context_string_list_v1(jsonb) from public, anon, authenticated;
revoke all on function public.reaction_generation_context_v1(jsonb) from public, anon, authenticated;
revoke all on function public.validate_reaction_generation_background_job_v1() from public, anon, authenticated;
revoke all on function public.validate_reaction_creative_origin_v1() from public, anon, authenticated;
revoke all on function public.validate_reaction_generation_plan_provenance_v1() from public, anon, authenticated;
revoke all on function public.ensure_reaction_generation_run_v1(uuid, text, uuid, integer, text, text, integer, jsonb) from public, anon, authenticated;
grant execute on function public.reaction_context_string_list_v1(jsonb) to service_role;
grant execute on function public.reaction_generation_context_v1(jsonb) to service_role;
grant execute on function public.validate_reaction_generation_background_job_v1() to service_role;
grant execute on function public.validate_reaction_creative_origin_v1() to service_role;
grant execute on function public.validate_reaction_generation_plan_provenance_v1() to service_role;
grant execute on function public.ensure_reaction_generation_run_v1(uuid, text, uuid, integer, text, text, integer, jsonb) to service_role;

select pg_notify('pgrst', 'reload schema');
