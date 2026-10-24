-- MCP acceptance and receipts are atomic. This does not enable any write gate.
create table public.mcp_business_onboarding_requests (
  user_id text not null,
  request_id uuid not null,
  mode text not null check (mode in ('legacy','background')),
  action text not null check (action in ('start','identity','goals','submit','edit')),
  input_json jsonb not null check (jsonb_typeof(input_json)='object'),
  result_json jsonb not null check (jsonb_typeof(result_json)='object'),
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
alter table public.mcp_business_onboarding_requests enable row level security;
revoke all on public.mcp_business_onboarding_requests from public,anon,authenticated,service_role;
grant select,insert on public.mcp_business_onboarding_requests to service_role;
create index mcp_business_onboarding_history_idx
  on public.mcp_business_onboarding_requests(user_id,created_at desc,request_id desc);

-- Raw snapshots stay inside the trusted service. The MCP adapter projects only
-- owned user-facing fields; the revision hashes the complete persisted profile.
create function public.mcp_read_business_onboarding(p_user_id text,p_background_enrolled boolean)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object(
    'mode',case when d.id is not null then 'background'
      when p.id is not null or exists(select 1 from public.background_jobs j
        where j.user_id=p_user_id and j.job_type='media_analysis'
        and j.input_json @> '{"operation":"business_profile_setup"}'::jsonb)
        or not coalesce(p_background_enrolled,false) then 'legacy' else 'background' end,
    'profile',case when p.id is null then null else to_jsonb(p) end,
    'draft',case when d.id is null then null else to_jsonb(d) end,
    'profile_revision',case when p.id is null then null
      else encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex') end
  ) from (select 1) singleton
  left join public.business_profiles p on p.user_id=p_user_id
  left join public.business_onboarding_drafts d on d.user_id=p_user_id
  where nullif(btrim(p_user_id),'') is not null;
$$;
revoke all on function public.mcp_read_business_onboarding(text,boolean) from public,anon,authenticated;
grant execute on function public.mcp_read_business_onboarding(text,boolean) to service_role;

create function public.mcp_mutate_business_onboarding(
  p_user_id text,p_request_id uuid,p_input jsonb,p_prepared jsonb,p_background_enrolled boolean
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  saved public.mcp_business_onboarding_requests%rowtype;
  d public.business_onboarding_drafts%rowtype;
  p public.business_profiles%rowtype;
  snapshot jsonb;
  fence jsonb:=p_input->'expected_state';
  change jsonb:=p_input->'change';
  action text:=p_input->'change'->>'action';
  mode text;
  payload jsonb;
  context jsonb;
  goals text[];
  logo jsonb;
  j jsonb;
  jobs jsonb:='[]'::jsonb;
  result jsonb;
begin
  if nullif(btrim(p_user_id),'') is null or p_request_id is null
    or jsonb_typeof(p_input) is distinct from 'object'
    or jsonb_typeof(fence) is distinct from 'object'
    or jsonb_typeof(change) is distinct from 'object'
    or coalesce(action,'') not in ('start','identity','goals','submit','edit') then
    raise exception 'mcp_onboarding_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('business-onboarding:'||p_user_id,0));
  select * into saved from public.mcp_business_onboarding_requests
    where user_id=p_user_id and request_id=p_request_id;
  if saved.request_id is not null then
    if saved.input_json is distinct from p_input then raise exception 'mcp_onboarding_request_conflict'; end if;
    return jsonb_build_object('replayed',true,'receipt',saved.result_json);
  end if;
  -- REST profile writes can acquire their row before the existing guard's owner
  -- lock. Never wait for such a row while holding that owner lock: return busy.
  select * into d from public.business_onboarding_drafts where user_id=p_user_id for update nowait;
  select * into p from public.business_profiles where user_id=p_user_id for update nowait;
  snapshot:=public.mcp_read_business_onboarding(p_user_id,p_background_enrolled);
  mode:=snapshot->>'mode';
  if fence->>'mode' is distinct from mode
    or fence->'profile_revision' is distinct from snapshot->'profile_revision'
    or fence->'draft_id' is distinct from coalesce(to_jsonb(d.id),'null'::jsonb)
    or fence->'draft_revision' is distinct from coalesce(to_jsonb(d.revision),'null'::jsonb) then
    raise exception 'mcp_onboarding_revision_conflict';
  end if;
  if action='identity' and change ? 'logo_storage_key' then
    logo:=p_prepared->'logo';
    if change->'logo_storage_key'='null'::jsonb then
      if logo is distinct from 'null'::jsonb then raise exception 'mcp_onboarding_invalid'; end if;
    elsif logo->>'storageKey' is distinct from change->>'logo_storage_key'
      or logo->>'storageKey' not like 'business-profile-logos/'||encode(sha256(convert_to(p_user_id,'UTF8')),'hex')||'/%' then
      raise exception 'mcp_onboarding_invalid';
    end if;
  end if;
  if mode='background' then
    if d.completed_at is not null then raise exception 'mcp_onboarding_already_completed'; end if;
    if d.submitted_at is not null and action not in ('edit','start') then raise exception 'mcp_onboarding_submitted'; end if;
    if action='start' then
      payload:=jsonb_build_object('requestKey',p_request_id,'input',change->'source','revision',d.revision);
    else
      if d.id is null then raise exception 'mcp_onboarding_not_found'; end if;
      payload:=jsonb_build_object('draftId',d.id,'revision',d.revision);
      if action='identity' then
        payload:=payload||jsonb_build_object('businessName',change->>'business_name',
          'logo',case when change ? 'logo_storage_key' then logo else d.logo end);
      elsif action in ('goals','submit') then
        payload:=payload||jsonb_build_object('primaryGoals',change->'primary_goals');
        if action='submit' then payload:=payload||jsonb_build_object('timezone',change->>'timezone'); end if;
      end if;
    end if;
    select * into d from public.mutate_business_onboarding_v1(p_user_id,action,payload);
    select coalesce(jsonb_agg(id),'[]'::jsonb) into jobs from (
      select distinct id from unnest(array[d.source_job_id,d.finalization_job_id]) id where id is not null
    ) selected;
  elsif action='start' then
    if p.id is not null and p.onboarding_status='completed' and p.onboarding_version>=3 then
      raise exception 'mcp_onboarding_already_completed';
    end if;
    if exists(select 1 from public.background_jobs x where x.user_id=p_user_id and x.job_type='media_analysis'
      and x.input_json @> '{"operation":"business_profile_setup"}'::jsonb
      and x.status in ('created','queued','processing','waiting_external_service','rendering','uploading_output','cancel_requested','stalled')) then
      raise exception 'mcp_onboarding_source_active';
    end if;
    j:=public.create_or_get_background_job_v1('business-profile-setup:mcp:'||encode(sha256(convert_to(p_user_id,'UTF8')),'hex')||':'||p_request_id,
      (change->'source')||jsonb_build_object('operation','business_profile_setup','userId',p_user_id,
        'mcpOnboardingRequestId',p_request_id),
      'business_profile_setup:'||p_user_id,'media_analysis',3,'default-project','ai-generation',p_user_id);
    jobs:=jsonb_build_array(j->'job'->'id');
  else
    if p.id is null then raise exception 'mcp_onboarding_not_found'; end if;
    if action='edit' then raise exception 'mcp_onboarding_unsupported'; end if;
    if action='identity' then
      context:=p_prepared->'context';
      if jsonb_typeof(context) is distinct from 'object' or context->>'businessName' is distinct from change->>'business_name'
        or length(btrim(coalesce(change->>'business_name',''))) not between 1 and 120
        or coalesce(p_prepared->>'content_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'mcp_onboarding_invalid'; end if;
      update public.business_profiles set context_json=context,content_hash=p_prepared->>'content_hash',
        onboarding_step=3,profile_version=profile_version+1,updated_at=now(),
        logo_storage_key=case when change ? 'logo_storage_key' then logo->>'storageKey' else logo_storage_key end,
        logo_url=case when change ? 'logo_storage_key' then logo->>'url' else logo_url end,
        logo_mime_type=case when change ? 'logo_storage_key' then logo->>'mimeType' else logo_mime_type end,
        logo_file_size_bytes=case when change ? 'logo_storage_key' then (logo->>'fileSizeBytes')::bigint else logo_file_size_bytes end,
        logo_width=case when change ? 'logo_storage_key' then (logo->>'width')::integer else logo_width end,
        logo_height=case when change ? 'logo_storage_key' then (logo->>'height')::integer else logo_height end
        where id=p.id returning * into p;
    else
      if jsonb_typeof(change->'primary_goals') is distinct from 'array' then raise exception 'mcp_onboarding_invalid'; end if;
      select coalesce(array_agg(value),'{}'::text[]) into goals from jsonb_array_elements_text(change->'primary_goals');
      if cardinality(goals)<> (select count(distinct goal) from unnest(goals) goal) then raise exception 'mcp_onboarding_invalid'; end if;
      if action='submit' and (cardinality(goals)=0 or nullif(btrim(p.context_json->>'businessName'),'') is null
        or not exists(select 1 from pg_timezone_names where name=change->>'timezone')) then raise exception 'mcp_onboarding_invalid'; end if;
      if p.onboarding_status='completed' and p.onboarding_version>=3 and goals is distinct from p.primary_goals then
        raise exception 'mcp_onboarding_already_completed';
      end if;
      -- Preserve the website's immutable completed-goal behavior. Identity edits
      -- are independent; completed goals need a separate brand/settings action.
      if p.onboarding_status<>'completed' or p.onboarding_version<3 then
        if action='goals' then
          update public.business_profiles set primary_goals=goals,primary_goal=goals[1],updated_at=now()
            where id=p.id returning * into p;
        else
          context:=p_prepared->'context';
          if jsonb_typeof(context) is distinct from 'object' or coalesce(p_prepared->>'content_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'mcp_onboarding_invalid'; end if;
          update public.business_profiles set context_json=context,content_hash=p_prepared->>'content_hash',
            primary_goals=goals,primary_goal=goals[1],onboarding_status='completed',onboarding_step=3,
            onboarding_version=3,onboarding_completed_at=now(),profile_version=profile_version+1,updated_at=now()
            where id=p.id returning * into p;
        end if;
      end if;
      if action='submit' then
        j:=public.create_or_get_background_job_v1('mcp-onboarding-complete:'||encode(sha256(convert_to(p_user_id,'UTF8')),'hex')||':'||p_request_id,
          jsonb_build_object('operation','business_profile_setup','userId',p_user_id,'legacyFinalizeOnly',true,
            'profileId',p.id,'profileVersion',p.profile_version,'timezone',change->>'timezone'),
          'business_profile_setup:'||p_user_id,'media_analysis',5,'default-project','ai-generation',p_user_id);
        jobs:=jsonb_build_array(j->'job'->'id');
      end if;
    end if;
  end if;
  snapshot:=public.mcp_read_business_onboarding(p_user_id,p_background_enrolled);
  result:=jsonb_build_object('request_id',p_request_id,'mode',mode,'action',action,'snapshot',snapshot,'job_ids',jobs);
  insert into public.mcp_business_onboarding_requests(user_id,request_id,mode,action,input_json,result_json)
    values(p_user_id,p_request_id,mode,action,p_input,result);
  return jsonb_build_object('replayed',false,'receipt',result);
end;
$$;
revoke all on function public.mcp_mutate_business_onboarding(text,uuid,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.mcp_mutate_business_onboarding(text,uuid,jsonb,jsonb,boolean) to service_role;

-- Fence all legacy setup callbacks, including older website-created jobs. A
-- cancelled/superseded analysis never replaces newer saved answers or context.
create function public.mcp_commit_legacy_onboarding_analysis(
  p_user_id text,p_job_id uuid,p_analysis_id uuid,p_context jsonb,p_content_hash text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  p public.business_profiles%rowtype;
  j public.background_jobs%rowtype;
  a public.website_analyses%rowtype;
  accepted public.mcp_business_onboarding_requests%rowtype;
  latest uuid;
  revision jsonb;
  expected jsonb;
begin
  if nullif(btrim(p_user_id),'') is null or p_job_id is null or p_analysis_id is null
    or jsonb_typeof(p_context) is distinct from 'object' or coalesce(p_content_hash,'') !~ '^[a-f0-9]{64}$' then
    raise exception 'mcp_onboarding_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('business-onboarding:'||p_user_id,0));
  select * into j from public.background_jobs where id=p_job_id and user_id=p_user_id for update nowait;
  if j.id is null or j.job_type<>'media_analysis' or j.input_json->>'operation' is distinct from 'business_profile_setup'
    or j.status not in ('processing','waiting_external_service') or j.input_json->>'legacyFinalizeOnly'='true'
    or exists(select 1 from public.business_onboarding_drafts where user_id=p_user_id) then
    return jsonb_build_object('changed',false,'profile',null,'skipped','superseded');
  end if;
  select id into latest from public.background_jobs where user_id=p_user_id and job_type='media_analysis'
    and input_json @> '{"operation":"business_profile_setup"}'::jsonb
    and coalesce(input_json->>'legacyFinalizeOnly','false')<>'true'
    order by created_at desc,id desc limit 1;
  if latest is distinct from j.id then return jsonb_build_object('changed',false,'profile',null,'skipped','superseded'); end if;
  select * into p from public.business_profiles where user_id=p_user_id for update nowait;
  select * into a from public.website_analyses where id=p_analysis_id and user_id=p_user_id and source_job_id=p_job_id;
  if a.id is null or a.analysis_json is distinct from p_context or a.source_type is distinct from j.input_json->>'intakeType' then
    raise exception 'mcp_onboarding_analysis_mismatch';
  end if;
  if p.id is not null and p.onboarding_step>=2 and p.analysis_id=a.id then
    return jsonb_build_object('changed',false,'profile',to_jsonb(p));
  end if;
  revision:=case when p.id is null then 'null'::jsonb else to_jsonb(encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex')) end;
  if j.input_json ? 'mcpOnboardingRequestId' then
    select * into accepted from public.mcp_business_onboarding_requests
      where user_id=p_user_id and request_id=(j.input_json->>'mcpOnboardingRequestId')::uuid and mode='legacy' and action='start';
    if accepted.request_id is null or not (accepted.result_json->'job_ids' ? p_job_id::text) then
      raise exception 'mcp_onboarding_analysis_mismatch';
    end if;
    expected:=accepted.input_json->'expected_state'->'profile_revision';
    if revision is distinct from expected then return jsonb_build_object('changed',false,'profile',null,'skipped','superseded'); end if;
  elsif p.id is not null and p.updated_at>j.created_at then
    return jsonb_build_object('changed',false,'profile',null,'skipped','superseded');
  end if;
  if p.id is not null and p.onboarding_step>=2 and p.content_hash=p_content_hash then
    return jsonb_build_object('changed',false,'profile',to_jsonb(p));
  end if;
  if p.id is null then
    insert into public.business_profiles(user_id,project_id,profile_version,analysis_id,content_hash,context_json,intake_type,
      onboarding_completed_at,onboarding_step,onboarding_status,onboarding_version,preparation_error,preparation_status,source_context,source_url)
    values(p_user_id,'default-project',1,a.id,p_content_hash,p_context,a.source_type,null,2,'incomplete',0,null,'preparing',
      left(a.source_context,24000),a.website_url) returning * into p;
  else
    update public.business_profiles set analysis_id=a.id,content_hash=p_content_hash,context_json=p_context,intake_type=a.source_type,
      onboarding_completed_at=null,onboarding_step=2,onboarding_status='incomplete',onboarding_version=0,
      preparation_error=null,preparation_status='preparing',source_context=left(a.source_context,24000),source_url=a.website_url,
      profile_version=profile_version+1,updated_at=now() where id=p.id returning * into p;
  end if;
  return jsonb_build_object('changed',true,'profile',to_jsonb(p));
end;
$$;
revoke all on function public.mcp_commit_legacy_onboarding_analysis(text,uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.mcp_commit_legacy_onboarding_analysis(text,uuid,uuid,jsonb,text) to service_role;
