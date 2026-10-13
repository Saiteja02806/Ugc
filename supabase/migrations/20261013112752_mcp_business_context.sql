-- Shared Settings drafts/active Business Context, with service-only immutable receipts.
-- Existing application apply function and onboarding guard are reused unchanged.
create table public.mcp_business_context_requests (
  user_id text not null check(length(btrim(user_id))>0),request_id uuid not null,
  operation text not null check(operation in ('save_draft','apply')),
  input_json jsonb not null check(jsonb_typeof(input_json)='object'),
  result_json jsonb not null check(jsonb_typeof(result_json)='object'),
  created_at timestamptz not null default clock_timestamp(),primary key(user_id,request_id)
);
alter table public.mcp_business_context_requests enable row level security;
revoke all on public.mcp_business_context_requests from public,anon,authenticated,service_role;
grant select,insert on public.mcp_business_context_requests to service_role;
create index mcp_business_context_requests_page_idx on public.mcp_business_context_requests(user_id,created_at desc,request_id desc);

create function public.mcp_business_context_snapshot(p public.business_profiles)
returns jsonb language sql stable security invoker set search_path='' as $f$
  select case when p.id is null then null else jsonb_build_object(
    'id',p.id,'context_revision',encode(sha256(convert_to(to_jsonb(p)::text,'UTF8')),'hex'),
    'active_profile_version',p.profile_version,'active_context',p.context_json,
    'primary_goals',case when cardinality(p.primary_goals)>0 then to_jsonb(p.primary_goals) when p.primary_goal is not null then jsonb_build_array(p.primary_goal) else '[]'::jsonb end,
    'intake_type',p.intake_type,'draft',case when p.business_context_draft_json is null then null else jsonb_build_object(
      'base_profile_version',p.business_context_draft_base_version,'context',p.business_context_draft_json,
      'source',p.business_context_draft_source,'updated_at',p.business_context_draft_updated_at) end) end;
$f$;
create function public.mcp_read_business_context(p_user_id text)
returns jsonb language sql stable security invoker set search_path='' as $f$
  select jsonb_build_object('profile',(select public.mcp_business_context_snapshot(p) from public.business_profiles p where p.user_id=p_user_id))
  where p_user_id is not null and length(btrim(p_user_id))>0;
$f$;
create function public.mcp_mutate_business_context(p_user_id text,p_request_id uuid,p_operation text,p_input jsonb,p_context jsonb,p_content_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $f$
declare prior public.mcp_business_context_requests; p public.business_profiles; accepted jsonb; allowed_keys text[];
begin
  if p_user_id is null or length(btrim(p_user_id))=0 or p_request_id is null or p_operation is null or p_operation not in ('save_draft','apply')
    or p_input is null or jsonb_typeof(p_input) is distinct from 'object' or pg_column_size(p_input)>64000 then raise exception 'mcp_business_context_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mcp-business-context-request:'||p_user_id||':'||p_request_id::text,0));
  select * into prior from public.mcp_business_context_requests where user_id=p_user_id and request_id=p_request_id;
  if found then
    if prior.operation is distinct from p_operation or prior.input_json is distinct from p_input then raise exception 'mcp_business_context_request_conflict'; end if;
    return jsonb_build_object('replayed',true,'receipt',prior.result_json);
  end if;
  allowed_keys:=array['context','expected_revision','expected_profile_version','expected_draft_updated_at'];
  if p_operation='save_draft' then allowed_keys:=allowed_keys||'source'::text; end if;
  if not (p_input?&allowed_keys) or (p_input-allowed_keys)<>'{}'::jsonb
    or jsonb_typeof(p_input->'context') is distinct from 'object' or jsonb_typeof(p_context) is distinct from 'object'
    or (p_context-'campaignPurposes') is distinct from ((p_input->'context')-'campaignPurposes')
    or jsonb_typeof(p_input->'expected_revision') is distinct from 'string' or (p_input->>'expected_revision')!~'^[a-f0-9]{64}$'
    or jsonb_typeof(p_input->'expected_profile_version') is distinct from 'number' or (p_input->>'expected_profile_version')!~'^[1-9][0-9]*$'
    or jsonb_typeof(p_input->'expected_draft_updated_at') not in ('null','string')
    or p_content_hash is null or p_content_hash!~'^[a-f0-9]{64}$'
    or (p_operation='save_draft' and (jsonb_typeof(p_input->'source') not in ('null','string') or length(p_input->>'source')>4000)) then raise exception 'mcp_business_context_invalid'; end if;
  select * into p from public.business_profiles where user_id=p_user_id for update;
  if not found then raise exception 'mcp_business_context_not_found'; end if;
  if (public.mcp_business_context_snapshot(p)->>'context_revision') is distinct from p_input->>'expected_revision'
    or p.profile_version is distinct from (p_input->>'expected_profile_version')::integer
    or p.business_context_draft_updated_at is distinct from (p_input->>'expected_draft_updated_at')::timestamptz then raise exception 'business_context_revision_conflict'; end if;
  if p_operation='save_draft' then
    update public.business_profiles set business_context_draft_json=p_context,business_context_draft_base_version=p.profile_version,
      business_context_draft_source=nullif(btrim(p_input->>'source'),''),business_context_draft_updated_at=clock_timestamp(),updated_at=clock_timestamp()
      where user_id=p_user_id returning * into p;
  else
    -- Same version promotion and future-day pinning policy as the website.
    select * into p from public.apply_business_context_v1(p_content_hash,p_context,
      (p_input->>'expected_draft_updated_at')::timestamptz,(p_input->>'expected_profile_version')::integer,p_user_id);
  end if;
  accepted:=jsonb_build_object('request_id',p_request_id,'operation',p_operation,'future_content_only',true,
    'state',jsonb_build_object('profile',public.mcp_business_context_snapshot(p)));
  insert into public.mcp_business_context_requests(user_id,request_id,operation,input_json,result_json) values(p_user_id,p_request_id,p_operation,p_input,accepted);
  return jsonb_build_object('replayed',false,'receipt',accepted);
end;
$f$;
revoke all on function public.mcp_business_context_snapshot(public.business_profiles),public.mcp_read_business_context(text),
  public.mcp_mutate_business_context(text,uuid,text,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.mcp_business_context_snapshot(public.business_profiles),public.mcp_read_business_context(text),
  public.mcp_mutate_business_context(text,uuid,text,jsonb,jsonb,text) to service_role;
select pg_notify('pgrst','reload schema');
