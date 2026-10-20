-- Answers are durable before an analyzed business profile exists. All state
-- transitions serialize per owner; external work never runs inside this lock.
create table public.business_onboarding_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id text not null unique,
  protocol_version integer not null default 1 check (protocol_version = 1),
  revision integer not null default 1 check (revision > 0),
  source_revision integer not null default 1 check (source_revision > 0),
  request_key text not null,
  source_input jsonb not null check (jsonb_typeof(source_input) = 'object'),
  source_job_id uuid references public.background_jobs(id),
  analysis_id uuid references public.website_analyses(id),
  business_name text not null default '' check (length(business_name) <= 120),
  logo jsonb,
  primary_goals text[] not null default '{}',
  step smallint not null default 2 check (step between 2 and 3),
  timezone text not null default 'UTC',
  submitted_at timestamptz,
  completed_at timestamptz,
  profile_id uuid references public.business_profiles(id),
  finalization_job_id uuid references public.background_jobs(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (primary_goals <@ array['increase_revenue','generate_leads','increase_signups',
    'increase_installs','grow_views','brand_awareness','grow_following',
    'increase_engagement','website_traffic','product_launch']::text[]),
  check (submitted_at is null or (length(btrim(business_name)) > 0 and cardinality(primary_goals) > 0)),
  check (completed_at is null or (submitted_at is not null and analysis_id is not null and profile_id is not null))
);
alter table public.business_onboarding_drafts enable row level security;
revoke all on public.business_onboarding_drafts from public, anon, authenticated;
grant select, insert, update on public.business_onboarding_drafts to service_role;
create index business_onboarding_source_job_idx on public.business_onboarding_drafts(source_job_id);
create index business_onboarding_analysis_idx on public.business_onboarding_drafts(analysis_id);
create index business_onboarding_profile_idx on public.business_onboarding_drafts(profile_id);
create index business_onboarding_finalization_idx on public.business_onboarding_drafts(finalization_job_id);

create or replace function public.mutate_business_onboarding_v1(
  p_user_id text, p_action text, p_payload jsonb
) returns public.business_onboarding_drafts
language plpgsql security invoker set search_path = '' as $$
declare
  d public.business_onboarding_drafts%rowtype;
  a public.website_analyses%rowtype;
  p public.business_profiles%rowtype;
  j jsonb;
  v_context jsonb;
  v_goals text[];
  v_purposes jsonb;
begin
  if nullif(btrim(p_user_id), '') is null then raise exception 'onboarding_owner_required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('business-onboarding:' || p_user_id, 0));
  select * into d from public.business_onboarding_drafts where user_id = p_user_id for update;

  if p_action = 'start' then
    if d.id is not null and d.request_key = p_payload->>'requestKey' then
      if d.source_input is distinct from p_payload->'input' then raise exception 'onboarding_request_conflict'; end if;
      return d;
    end if;
    select * into p from public.business_profiles where user_id = p_user_id;
    if d.id is null and exists(select 1 from public.background_jobs where user_id=p_user_id
        and job_type='media_analysis' and input_json @> '{"operation":"business_profile_setup"}'::jsonb) then
      raise exception 'onboarding_legacy_profile';
    end if;
    if p.id is not null and (d.id is null or p.onboarding_status = 'completed' and p.onboarding_version >= 3) then
      raise exception 'onboarding_legacy_profile';
    end if;
    if d.id is not null and d.source_input = p_payload->'input' then return d; end if;
    if d.id is not null and (d.submitted_at is not null or d.revision is distinct from (p_payload->>'revision')::integer) then
      raise exception 'onboarding_revision_conflict';
    end if;
    if nullif(p_payload->>'requestKey','') is null or jsonb_typeof(p_payload->'input') is distinct from 'object'
      or coalesce(p_payload->'input'->>'intakeType','') not in ('website','manual','mobile_app_ai_prompt') then
      raise exception 'onboarding_input_invalid';
    end if;
    if d.id is null then
      insert into public.business_onboarding_drafts(user_id,request_key,source_input)
      values(p_user_id,p_payload->>'requestKey',p_payload->'input') returning * into d;
    else
      update public.business_onboarding_drafts set source_input=p_payload->'input', request_key=p_payload->>'requestKey',
        source_revision=source_revision+1, revision=revision+1, analysis_id=null, source_job_id=null,
        finalization_job_id=null, step=2, updated_at=now() where id=d.id returning * into d;
    end if;
    j := public.create_or_get_background_job_v1('onboarding-analysis:' || d.id || ':' || d.source_revision,
      d.source_input || jsonb_build_object('operation','business_profile_setup','userId',p_user_id,
        'onboardingDraftId',d.id,'sourceRevision',d.source_revision),
      'business_onboarding:' || d.id,'media_analysis',3,'default-project','ai-generation',p_user_id);
    update public.business_onboarding_drafts set source_job_id=(j->'job'->>'id')::uuid
      where id=d.id returning * into d;
    return d;
  end if;

  if d.id is null or d.id::text is distinct from p_payload->>'draftId' then raise exception 'onboarding_draft_not_found'; end if;
  if p_action in ('attach','finalize') then
    if d.source_revision is distinct from (p_payload->>'sourceRevision')::integer then return d; end if;
  elsif d.completed_at is not null then
    return d;
  elsif d.revision is distinct from (p_payload->>'revision')::integer then
    raise exception 'onboarding_revision_conflict';
  end if;

  if p_action = 'attach' then
    if d.source_job_id::text is distinct from p_payload->>'jobId' or d.completed_at is not null then return d; end if;
    select * into a from public.website_analyses where id=(p_payload->>'analysisId')::uuid
      and user_id=p_user_id and source_job_id=d.source_job_id;
    if a.id is null then raise exception 'onboarding_analysis_mismatch'; end if;
    update public.business_onboarding_drafts set analysis_id=a.id, updated_at=now()
      where id=d.id returning * into d;
  elsif p_action = 'edit' then
    update public.business_onboarding_drafts set submitted_at=null, finalization_job_id=null,
      revision=revision+1, updated_at=now() where id=d.id returning * into d;
  elsif p_action in ('identity','goals','submit') then
    if d.submitted_at is not null then return d; end if;
    if p_action = 'identity' then
      if length(btrim(coalesce(p_payload->>'businessName',''))) not between 1 and 120 then
        raise exception 'onboarding_name_required';
      end if;
      update public.business_onboarding_drafts set business_name=btrim(p_payload->>'businessName'),
        logo=nullif(p_payload->'logo','null'::jsonb), step=3, revision=revision+1, updated_at=now()
        where id=d.id returning * into d;
    else
      select coalesce(array_agg(value), '{}'::text[]) into v_goals from jsonb_array_elements_text(p_payload->'primaryGoals');
      if cardinality(v_goals) <> (select count(distinct x) from unnest(v_goals) x) then raise exception 'onboarding_goals_invalid'; end if;
      if p_action='submit' and (cardinality(v_goals)=0 or d.business_name='') then raise exception 'onboarding_answers_required'; end if;
      if p_action='submit' and not exists(select 1 from pg_timezone_names where name=p_payload->>'timezone') then
        raise exception 'onboarding_timezone_invalid';
      end if;
      update public.business_onboarding_drafts set primary_goals=v_goals, revision=revision+1, updated_at=now(),
        submitted_at=case when p_action='submit' then now() else null end,
        timezone=case when p_action='submit' then p_payload->>'timezone' else timezone end
        where id=d.id returning * into d;
    end if;
  elsif p_action = 'finalize' then
    if d.finalization_job_id::text is distinct from p_payload->>'jobId' then return d; end if;
    if d.completed_at is not null then return d; end if;
    if d.submitted_at is null or d.analysis_id is null then raise exception 'onboarding_not_ready'; end if;
    select * into a from public.website_analyses where id=d.analysis_id and user_id=p_user_id and source_job_id=d.source_job_id;
    if a.id is null then raise exception 'onboarding_analysis_mismatch'; end if;
    -- The service validates this exact stored analysis with the current schema.
    if a.analysis_json is distinct from p_payload->'analysis' then raise exception 'onboarding_analysis_changed'; end if;
    select jsonb_agg(purpose order by first_position) into v_purposes from (
      select purpose,min(position) first_position from (
        select case when goal='increase_installs' then 'app_install'
          when goal in ('increase_revenue','generate_leads','increase_signups') then 'conversion'
          when goal='increase_engagement' then 'education' else 'product_discovery' end purpose,position
        from unnest(array['increase_revenue','generate_leads','increase_signups','increase_installs','grow_views',
          'brand_awareness','grow_following','increase_engagement','website_traffic','product_launch'])
          with ordinality as goals(goal,position) where goal=any(d.primary_goals)
      ) mapped group by purpose
    ) purposes;
    v_context := a.analysis_json || jsonb_build_object('businessName',d.business_name,'campaignPurposes',v_purposes,
      'businessModel',coalesce(a.analysis_json->'businessModel','null'::jsonb),
      'categories',coalesce(a.analysis_json->'categories',case when a.analysis_json->>'category' is null then '[]'::jsonb else jsonb_build_array(a.analysis_json->>'category') end));
    perform set_config('ugc.onboarding_draft_writer',d.id::text,true);
    insert into public.business_profiles(user_id,intake_type,analysis_id,context_json,content_hash,
      source_url,source_context,onboarding_status,onboarding_step,onboarding_version,onboarding_completed_at,
      primary_goal,primary_goals,trending_timezone,logo_storage_key,logo_url,logo_mime_type,logo_file_size_bytes,logo_width,logo_height)
    values(p_user_id,d.source_input->>'intakeType',a.id,v_context,
      encode(sha256(convert_to(v_context::text,'UTF8')),'hex'),a.website_url,a.source_context,'completed',3,3,now(),
      d.primary_goals[1],d.primary_goals,d.timezone,d.logo->>'storageKey',d.logo->>'url',d.logo->>'mimeType',
      (d.logo->>'fileSizeBytes')::bigint,(d.logo->>'width')::integer,(d.logo->>'height')::integer)
      returning * into p;
    update public.business_onboarding_drafts set profile_id=p.id,completed_at=p.onboarding_completed_at,updated_at=now()
      where id=d.id returning * into d;
    return d;
  else
    raise exception 'onboarding_action_invalid';
  end if;

  -- Both arrival orders use this transaction. The job cannot be lost between
  -- accepted answers/analysis and dispatch, even when the browser closes.
  if d.submitted_at is not null and d.analysis_id is not null and d.finalization_job_id is null then
    j := public.create_or_get_background_job_v1('onboarding-finalize:' || d.id || ':' || d.source_revision || ':' || d.revision,
      d.source_input || jsonb_build_object('operation','business_profile_setup','userId',p_user_id,
        'onboardingDraftId',d.id,'sourceRevision',d.source_revision,'finalizeOnly',true),
      'business_onboarding:' || d.id,'media_analysis',5,'default-project','ai-generation',p_user_id);
    update public.business_onboarding_drafts set finalization_job_id=(j->'job'->>'id')::uuid
      where id=d.id returning * into d;
  end if;
  return d;
end;
$$;
revoke all on function public.mutate_business_onboarding_v1(text,text,jsonb) from public,anon,authenticated;
grant execute on function public.mutate_business_onboarding_v1(text,text,jsonb) to service_role;

-- Old tabs/jobs may still finish after enrollment. Never let the legacy writer
-- replace the new profile or reset its completion. Content preparation fields
-- and timezone/walkthrough writes remain independently mutable.
create or replace function public.guard_background_onboarding_profile_v1()
returns trigger language plpgsql security invoker set search_path='' as $$
declare v_draft_id uuid;
begin
  if tg_op='UPDATE' and row(new.context_json,new.analysis_id,new.onboarding_status,new.onboarding_step,
      new.onboarding_version,new.onboarding_completed_at,new.primary_goals,new.logo_storage_key)
    is not distinct from row(old.context_json,old.analysis_id,old.onboarding_status,old.onboarding_step,
      old.onboarding_version,old.onboarding_completed_at,old.primary_goals,old.logo_storage_key) then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended('business-onboarding:' || new.user_id,0));
  select id into v_draft_id from public.business_onboarding_drafts where user_id=new.user_id;
  if v_draft_id is not null and current_setting('ugc.onboarding_draft_writer',true) is distinct from v_draft_id::text then
    raise exception 'onboarding_legacy_write_rejected';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_background_onboarding_profile_v1() from public,anon,authenticated;
grant execute on function public.guard_background_onboarding_profile_v1() to service_role;
create trigger guard_background_onboarding_profile before insert or update on public.business_profiles
  for each row execute function public.guard_background_onboarding_profile_v1();
