-- Agent library metadata writes share the website's real groups and memberships.
-- No media deletion, credit reservation, provider dispatch or worker state is changed.
create table public.mcp_creative_group_requests (
  user_id text not null check (char_length(btrim(user_id)) between 1 and 200),
  request_id uuid not null,
  operation text not null check (operation in ('create','rename','delete','add','remove')),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  input_json jsonb not null check (jsonb_typeof(input_json)='object' and octet_length(input_json::text)<=100000),
  result_json jsonb not null check (jsonb_typeof(result_json)='object' and octet_length(result_json::text)<=100000),
  created_at timestamptz not null default now(),
  primary key(user_id,request_id)
);
create index mcp_creative_group_requests_owner_created on public.mcp_creative_group_requests(user_id,created_at desc,request_id desc);
alter table public.mcp_creative_group_requests enable row level security;
revoke all on public.mcp_creative_group_requests from public,anon,authenticated;
grant select,insert on public.mcp_creative_group_requests to service_role;

-- Existing application queries keep their indexes; agent pages use deterministic tie-breaks.
create index mcp_creative_groups_owner_page on public.creative_asset_groups(user_id,media_type,updated_at desc,id desc);
create index mcp_creative_group_items_owner_page on public.creative_asset_group_items(user_id,group_id,created_at desc,media_asset_id desc);

-- The revision binds every existing member, including temporarily hidden/unavailable items.
-- It therefore detects website membership changes without changing website triggers.
create function public.mcp_read_creative_asset_group(p_user_id text,p_group_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare g public.creative_asset_groups%rowtype; members jsonb; snapshot jsonb;
begin
  if p_user_id is null or char_length(btrim(p_user_id)) not between 1 and 200 then raise exception 'invalid_group_owner'; end if;
  select * into g from public.creative_asset_groups where id=p_group_id and user_id=p_user_id;
  if not found then return null; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',media_asset_id,'added_at',created_at) order by media_asset_id),'[]'::jsonb)
    into members from public.creative_asset_group_items where group_id=g.id and user_id=p_user_id;
  snapshot:=jsonb_build_object('group',to_jsonb(g)-'user_id','members',members);
  return jsonb_build_object('group',snapshot->'group','member_count',jsonb_array_length(members),
    'revision',encode(sha256(convert_to(snapshot::text,'UTF8')),'hex'));
end;
$$;
revoke all on function public.mcp_read_creative_asset_group(text,uuid) from public,anon,authenticated;
grant execute on function public.mcp_read_creative_asset_group(text,uuid) to service_role;

create function public.mcp_mutate_creative_asset_group(p_user_id text,p_request_id uuid,p_operation text,p_input jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  previous public.mcp_creative_group_requests%rowtype;
  g public.creative_asset_groups%rowtype;
  fingerprint text; target uuid; normalized jsonb; expected text; state jsonb; result jsonb;
  selected_ids uuid[]; affected integer:=0; bad_asset boolean; group_exists boolean;
begin
  if p_user_id is null or char_length(btrim(p_user_id)) not between 1 and 200 or p_request_id is null
    or p_operation is null or p_operation not in ('create','rename','delete','add','remove')
    or p_input is null or jsonb_typeof(p_input)<>'object' or octet_length(p_input::text)>100000 then raise exception 'invalid_group_request'; end if;
  if p_operation='create' then
    if (select array_agg(k order by k) from jsonb_object_keys(p_input) k) is distinct from array['media_type','name']::text[]
      or jsonb_typeof(p_input->'name')<>'string' or p_input->>'media_type' not in ('video','image') then raise exception 'invalid_group_request'; end if;
    normalized:=jsonb_build_object('name',btrim(p_input->>'name'),'media_type',p_input->>'media_type');
    target:=p_request_id;
  elsif p_operation='rename' then
    if (select array_agg(k order by k) from jsonb_object_keys(p_input) k) is distinct from array['expected_revision','group_id','name']::text[]
      or jsonb_typeof(p_input->'name')<>'string' then raise exception 'invalid_group_request'; end if;
    normalized:=jsonb_build_object('name',btrim(p_input->>'name'),'group_id',(p_input->>'group_id')::uuid,'expected_revision',p_input->>'expected_revision');
  elsif p_operation='delete' then
    if (select array_agg(k order by k) from jsonb_object_keys(p_input) k) is distinct from array['expected_revision','group_id']::text[] then raise exception 'invalid_group_request'; end if;
    normalized:=jsonb_build_object('group_id',(p_input->>'group_id')::uuid,'expected_revision',p_input->>'expected_revision');
  else
    if (select array_agg(k order by k) from jsonb_object_keys(p_input) k) is distinct from array['asset_ids','expected_revision','group_id']::text[]
      or jsonb_typeof(p_input->'asset_ids')<>'array' or jsonb_array_length(p_input->'asset_ids') not between 1 and 100
      or exists(select 1 from jsonb_array_elements(p_input->'asset_ids') v where jsonb_typeof(v)<>'string') then raise exception 'invalid_group_request'; end if;
    select array_agg((v #>> '{}')::uuid order by (v #>> '{}')::uuid) into selected_ids from jsonb_array_elements(p_input->'asset_ids') v;
    if cardinality(selected_ids)<>(select count(distinct v) from unnest(selected_ids) v) then raise exception 'invalid_group_request'; end if;
    normalized:=jsonb_build_object('asset_ids',to_jsonb(selected_ids),'group_id',(p_input->>'group_id')::uuid,'expected_revision',p_input->>'expected_revision');
  end if;
  if p_operation in ('create','rename') and (jsonb_typeof(normalized->'name')<>'string' or char_length(normalized->>'name') not between 1 and 80) then raise exception 'invalid_group_request'; end if;
  if p_operation<>'create' then
    target:=(normalized->>'group_id')::uuid; expected:=normalized->>'expected_revision';
    if target is null or expected is null or expected !~ '^[a-f0-9]{64}$' then raise exception 'invalid_group_request'; end if;
  end if;
  fingerprint:=encode(sha256(convert_to(jsonb_build_object('operation',p_operation,'input',normalized)::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('mcp-group-request:'||p_user_id||':'||p_request_id::text,0));
  select * into previous from public.mcp_creative_group_requests where user_id=p_user_id and request_id=p_request_id;
  if found then
    if previous.payload_hash<>fingerprint then raise exception 'group_request_conflict'; end if;
    return jsonb_build_object('replayed',true,'receipt',previous.result_json);
  end if;
  -- Canonical website insert validation takes SHARE on this same group. Lock
  -- existing member rows as well so concurrent website removals serialize.
  if p_operation='create' then
    if exists(select 1 from public.creative_asset_groups where id=target) then raise exception 'group_id_conflict'; end if;
    insert into public.creative_asset_groups(id,user_id,name,media_type) values(target,p_user_id,normalized->>'name',normalized->>'media_type');
    affected:=1;
  else
    select * into g from public.creative_asset_groups where id=target and user_id=p_user_id for update;
    if not found then raise exception 'group_not_found'; end if;
    perform media_asset_id from public.creative_asset_group_items where group_id=target and user_id=p_user_id order by media_asset_id for update;
    state:=public.mcp_read_creative_asset_group(p_user_id,target);
    if state->>'revision'<>expected then raise exception 'group_revision_conflict'; end if;
    if p_operation='rename' then
      if g.name is distinct from normalized->>'name' then update public.creative_asset_groups set name=normalized->>'name' where id=target and user_id=p_user_id; affected:=1; end if;
    elsif p_operation='delete' then
      delete from public.creative_asset_groups where id=target and user_id=p_user_id; get diagnostics affected=row_count;
    elsif p_operation='add' then
      -- Validate the whole set before writing, reusing ready/type/owner triggers.
      perform id from public.media_assets where id=any(selected_ids) order by id for share;
      select exists(select 1 from unnest(selected_ids) wanted(id) left join public.media_assets a on a.id=wanted.id
        where a.id is null or a.user_id<>p_user_id or a.status<>'ready' or a.deleted_at is not null
          or (g.media_type='image' and a.collection<>'image') or (g.media_type='video' and a.collection not in ('video','influencer'))
          or a.source_type in ('catalog_influencer','combined_render','wall_text_render','reaction_render')
          or a.metadata->>'libraryVisibility'='hook_videos_only') into bad_asset;
      if bad_asset then raise exception 'group_asset_unavailable'; end if;
      insert into public.creative_asset_group_items(user_id,group_id,media_asset_id)
        select p_user_id,target,v from unnest(selected_ids) v on conflict(group_id,media_asset_id) do nothing;
      get diagnostics affected=row_count;
    else
      delete from public.creative_asset_group_items where group_id=target and user_id=p_user_id and media_asset_id=any(selected_ids);
      get diagnostics affected=row_count;
    end if;
  end if;
  state:=public.mcp_read_creative_asset_group(p_user_id,target); group_exists:=state is not null;
  result:=jsonb_build_object('request_id',p_request_id,'operation',p_operation,'group_id',target,'changed_count',affected,
    'group_exists',group_exists,'state',state);
  insert into public.mcp_creative_group_requests(user_id,request_id,operation,payload_hash,input_json,result_json)
    values(p_user_id,p_request_id,p_operation,fingerprint,normalized,result);
  return jsonb_build_object('replayed',false,'receipt',result);
end;
$$;
revoke all on function public.mcp_mutate_creative_asset_group(text,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_mutate_creative_asset_group(text,uuid,text,jsonb) to service_role;
select pg_notify('pgrst','reload schema');
