-- Additive IDE Library requests. Canonical website save RPCs remain unchanged.
create table public.mcp_library_requests (
  user_id text not null check (length(btrim(user_id)) > 0),
  request_id uuid not null,
  operation text not null check (operation in ('save_carousel','save_slideshow','remove')),
  input_json jsonb not null check (jsonb_typeof(input_json) = 'object'),
  result_json jsonb not null check (jsonb_typeof(result_json) = 'object'),
  created_at timestamptz not null default now(),
  primary key (user_id,request_id)
);
alter table public.mcp_library_requests enable row level security;
revoke all on public.mcp_library_requests from public,anon,authenticated;
grant select,insert on public.mcp_library_requests to service_role;
create index mcp_library_requests_owner_page_idx on public.mcp_library_requests(user_id,created_at desc,request_id desc);
create index mcp_library_items_owner_page_idx on public.library_items(user_id,updated_at desc,id desc)
  where source_type='generated_carousel' and media_type='carousel' and deleted_at is null;

create index mcp_library_carousel_source_page_idx on public.carousel_generations(user_id,updated_at desc,id desc);

-- Hash the whole stored item/ordered snapshot, including metadata and deletion.
create function public.mcp_read_library_item(p_user_id text,p_item_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('revision',encode(sha256(convert_to(
    jsonb_build_object('item',to_jsonb(i),'slides',s.raw)::text,'UTF8')),'hex'),
    'deleted_at',i.deleted_at,'status',i.status,'item',jsonb_build_object(
      'id',i.id,'title',i.title,'project_id',i.project_id,'source_id',i.source_id,
      'kind',case when i.metadata->>'exploreFormat'='slideshow' then 'slideshow' else 'carousel' end,
      'cover_url',i.cover_url,'thumbnail_url',i.thumbnail_url,'created_at',i.created_at,'updated_at',i.updated_at,
      'slides',s.visible))
  from public.library_items i cross join lateral (
    select coalesce(jsonb_agg(to_jsonb(c) order by c.slide_number,c.id),'[]'::jsonb) raw,
      coalesce(jsonb_agg(jsonb_build_object('id',c.id,'slide_number',c.slide_number,
        'carousel_generation_id',c.carousel_generation_id,'carousel_slide_id',c.carousel_slide_id,
        'headline',c.headline,'subtext',c.subtext,'slide_type',c.slide_type,
        'rendered_url',c.rendered_url,'rendered_storage_key',c.rendered_s3_key,
        'metadata',c.metadata) order by c.slide_number,c.id),'[]'::jsonb) visible
    from public.library_carousel_slides c where c.library_item_id=i.id
  ) s where i.user_id=p_user_id and i.id=p_item_id and i.source_type='generated_carousel' and i.media_type='carousel';
$$;

-- Destination includes tombstones so a removed save cannot be silently restored.
create function public.mcp_library_destination(p_user_id text,p_source_id text)
returns jsonb language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('revision',encode(sha256(convert_to(v.items::text,'UTF8')),'hex'),
    'items',v.items) from (select coalesce(jsonb_agg(public.mcp_read_library_item(p_user_id,i.id)
    order by i.id),'[]'::jsonb) items from public.library_items i
    where i.user_id=p_user_id and i.source_type='generated_carousel' and i.source_id=p_source_id) v;
$$;

-- Bind actual generation/slide/edit rows rather than caller-supplied URLs.
create function public.mcp_library_source_revision(p_user_id text,p_source_id uuid)
returns text language sql stable security invoker set search_path='' as $$
  select encode(sha256(convert_to(jsonb_build_object('generation',to_jsonb(g),
    'slides',(select coalesce(jsonb_agg(to_jsonb(s) order by s.slide_number,s.id),'[]'::jsonb)
      from public.carousel_slides s where s.carousel_generation_id=g.id),
    'edits',(select coalesce(jsonb_agg(to_jsonb(e) order by e.id),'[]'::jsonb)
      from public.trending_creative_edits e where e.user_id=p_user_id and e.format='carousel' and e.creative_id=g.id)
    )::text,'UTF8')),'hex') from public.carousel_generations g where g.user_id=p_user_id and g.id=p_source_id;
$$;

create function public.mcp_mutate_library(p_user_id text,p_request_id uuid,p_operation text,p_input jsonb,p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.mcp_library_requests%rowtype; item_id uuid; v_source_id text;
  source_uuid uuid; destination jsonb; state jsonb; result jsonb; was_created boolean;
begin
  if p_user_id is null or length(btrim(p_user_id))=0 or p_request_id is null or
    p_operation is null or p_operation not in ('save_carousel','save_slideshow','remove') or jsonb_typeof(p_input) is distinct from 'object'
    then raise exception 'invalid_library_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('mcp-library-request:'||p_user_id||':'||p_request_id::text,0));
  select * into saved from public.mcp_library_requests where user_id=p_user_id and request_id=p_request_id;
  if found then
    if saved.operation is distinct from p_operation or saved.input_json is distinct from p_input
      then raise exception 'library_request_conflict'; end if;
    return jsonb_build_object('replayed',true,'receipt',saved.result_json);
  end if;
  if p_operation='remove' then
    if not (p_input ?& array['item_id','expected_revision']) or
      (p_input - array['item_id','expected_revision']) <> '{}'::jsonb then raise exception 'invalid_library_request'; end if;
    item_id := (p_input->>'item_id')::uuid;
    perform 1 from public.library_items where id=item_id and user_id=p_user_id for update;
    perform 1 from public.library_carousel_slides where library_item_id=item_id order by id for update;
    state := public.mcp_read_library_item(p_user_id,item_id);
    if state is null then raise exception 'library_not_found'; end if;
    if state->>'revision' is distinct from p_input->>'expected_revision' then raise exception 'library_revision_conflict'; end if;
    if state->>'deleted_at' is not null then raise exception 'library_removed'; end if;
    update public.library_items set deleted_at=now(),status='archived',updated_at=now() where id=item_id and user_id=p_user_id;
    was_created := false;
  elsif p_operation='save_carousel' then
    if not (p_input ?& array['carousel_id','source_revision','destination_revision','allow_recreate_removed']) or
      (p_input - array['carousel_id','source_revision','destination_revision','allow_recreate_removed']) <> '{}'::jsonb or
      jsonb_typeof(p_input->'allow_recreate_removed') <> 'boolean' then raise exception 'invalid_library_request'; end if;
    source_uuid := (p_input->>'carousel_id')::uuid; v_source_id := source_uuid::text;
    perform pg_advisory_xact_lock(hashtextextended('mcp-library-source:'||p_user_id||':'||v_source_id,0));
    perform 1 from public.carousel_generations where id=source_uuid and user_id=p_user_id for update;
    perform 1 from public.carousel_slides where carousel_generation_id=source_uuid order by id for update;
    perform 1 from public.trending_creative_edits where user_id=p_user_id and format='carousel' and creative_id=source_uuid order by id for update;
    if public.mcp_library_source_revision(p_user_id,source_uuid) is null then raise exception 'library_not_found'; end if;
    if public.mcp_library_source_revision(p_user_id,source_uuid) is distinct from p_input->>'source_revision' then raise exception 'library_source_conflict'; end if;
    perform 1 from public.library_items where user_id=p_user_id and source_type='generated_carousel' and source_id=source_uuid::text order by id for update;
    perform 1 from public.library_carousel_slides where library_item_id in
      (select id from public.library_items where user_id=p_user_id and source_type='generated_carousel' and source_id=source_uuid::text) order by id for update;
    destination := public.mcp_library_destination(p_user_id,v_source_id);
    if destination->>'revision' is distinct from p_input->>'destination_revision' then raise exception 'library_revision_conflict'; end if;
    if jsonb_array_length(destination->'items')>0 and not exists
      (select 1 from jsonb_array_elements(destination->'items') i where i->>'deleted_at' is null)
      and p_input->>'allow_recreate_removed' <> 'true' then raise exception 'library_removed'; end if;
    if p_payload->>'p_user_id' is distinct from p_user_id or p_payload->>'p_source_id' is distinct from v_source_id or
      jsonb_typeof(p_payload->'p_slides') is distinct from 'array' then raise exception 'invalid_library_request'; end if;
    select r.item_id,r.created into item_id,was_created from public.save_generated_carousel_library_item(
      p_user_id,p_payload->>'p_project_id',v_source_id,p_payload->>'p_title',p_payload->>'p_cover_url',
      p_payload->>'p_thumbnail_url',p_payload->'p_metadata',p_payload->'p_slides') r;
  else
    if p_input->>'version' is distinct from '2' or p_input->>'requestKey' is distinct from p_request_id::text or
      p_payload->>'p_user_id' is distinct from p_user_id or p_payload->>'p_request_key' is distinct from p_request_id::text
      then raise exception 'invalid_library_request'; end if;
    -- Canonical slideshow RPC already checks assets/order/request fingerprint, including removed saves.
    perform pg_advisory_xact_lock(hashtextextended(p_user_id || ':explore-slideshow:' || p_request_id::text,0));
    was_created := not exists(select 1 from public.library_items where user_id=p_user_id and source_type='generated_carousel' and source_id='explore-slideshow:'||p_request_id::text);
    item_id := public.explore_save_slideshow(p_user_id,p_request_id,p_payload->>'p_fingerprint',p_payload->>'p_title',p_payload->'p_slides',p_payload->'p_metadata');

  end if;
  state := public.mcp_read_library_item(p_user_id,item_id);
  result := jsonb_build_object('request_id',p_request_id,'operation',p_operation,'item_id',item_id,
    'created',was_created,'state',state);
  insert into public.mcp_library_requests(user_id,request_id,operation,input_json,result_json)
    values(p_user_id,p_request_id,p_operation,p_input,result);
  return jsonb_build_object('replayed',false,'receipt',result);
end;
$$;
revoke all on function public.mcp_read_library_item(text,uuid),public.mcp_library_destination(text,text),
  public.mcp_library_source_revision(text,uuid),public.mcp_mutate_library(text,uuid,text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.mcp_read_library_item(text,uuid),public.mcp_library_destination(text,text),
  public.mcp_library_source_revision(text,uuid),public.mcp_mutate_library(text,uuid,text,jsonb,jsonb) to service_role;
