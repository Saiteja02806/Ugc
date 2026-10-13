-- Explore clip edits save as JSON independently of exporting a publishing file.
-- Firebase ownership is checked in the route; only the server may call this RPC.
create table public.explore_clip_drafts (
  id uuid primary key default gen_random_uuid(), user_id text not null,
  scope text not null check (scope ~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,159}$'),
  source_asset_id uuid not null references public.media_assets(id),
  revision bigint not null check (revision between 1 and 9007199254740991),
  content jsonb not null check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (user_id, scope, source_asset_id)
);
alter table public.explore_clip_drafts enable row level security;
revoke all on public.explore_clip_drafts from public, anon, authenticated;
grant select, insert, update on public.explore_clip_drafts to service_role;

create table public.explore_clip_draft_saves (
  user_id text not null, request_id uuid not null, scope text not null,
  source_asset_id uuid not null, expected_revision bigint not null,
  content jsonb not null, accepted_draft jsonb not null,
  created_at timestamptz not null default clock_timestamp(), primary key (user_id, request_id)
);
alter table public.explore_clip_draft_saves enable row level security;
revoke all on public.explore_clip_draft_saves from public, anon, authenticated;
grant select, insert on public.explore_clip_draft_saves to service_role;

create function public.explore_save_clip_draft(
  p_user_id text, p_scope text, p_source_asset_id uuid,
  p_request_id uuid, p_expected_revision bigint, p_content jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.explore_clip_drafts%rowtype; receipt public.explore_clip_draft_saves%rowtype;
  source_duration numeric; accepted jsonb; trim_start numeric; trim_end numeric;
begin
  if nullif(btrim(p_user_id),'') is null or length(p_user_id) > 128 or p_scope is null or
     p_scope !~ '^[A-Za-z0-9][A-Za-z0-9:_-]{0,159}$' or p_source_asset_id is null or p_request_id is null or
     p_expected_revision is null or p_expected_revision not between 0 and 9007199254740991 or
     p_content is null or jsonb_typeof(p_content) <> 'object' or octet_length(p_content::text) > 32768 or
     p_content->>'version' is distinct from '1' or p_content->>'sourceAssetId' is distinct from p_source_asset_id::text or
     jsonb_typeof(p_content->'editing') is distinct from 'object' or
     p_content->'editing'->>'version' is distinct from '1' or
     coalesce(p_content->'editing'->>'format','') not in ('hook','wall_text') or
     jsonb_typeof(p_content->'editing'->'trimStartMs') is distinct from 'number' or
     jsonb_typeof(p_content->'editing'->'trimEndMs') is distinct from 'number' or
     coalesce(p_content->>'backgroundPlayback','') not in ('once','repeat') or
     not (p_content ? 'backgroundAssetId') or jsonb_typeof(p_content->'backgroundAssetId') not in ('string','null') or
     (p_content->>'backgroundAssetId' is null and p_content->>'backgroundPlayback' <> 'once') then
    raise exception 'clip_draft_invalid';
  end if;
  -- Serialize request UUIDs independently of clips, so a UUID cannot be reused
  -- against another source. Replay is checked before source availability.
  perform pg_advisory_xact_lock(hashtextextended('explore-clip-save:' || p_user_id || ':' || p_request_id::text,0));
  select * into receipt from public.explore_clip_draft_saves where user_id=p_user_id and request_id=p_request_id;
  if found then
    if receipt.scope <> p_scope or receipt.source_asset_id <> p_source_asset_id or
       receipt.expected_revision <> p_expected_revision or receipt.content <> p_content then raise exception 'clip_draft_request_conflict'; end if;
    return jsonb_build_object('user_id',p_user_id,'request_id',p_request_id,'draft',receipt.accepted_draft,'replayed',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended('explore-clip:' || p_user_id || ':' || p_scope || ':' || p_source_asset_id::text,0));
  select * into saved from public.explore_clip_drafts
    where user_id=p_user_id and scope=p_scope and source_asset_id=p_source_asset_id for update;
  if (found and saved.revision <> p_expected_revision) or (not found and p_expected_revision <> 0) then raise exception 'clip_draft_changed'; end if;
  select duration_seconds into source_duration from public.media_assets where id=p_source_asset_id and user_id=p_user_id
    and collection='video' and status='ready' and deleted_at is null and coalesce(metadata->>'testOnly','false') <> 'true';
  if not found then raise exception 'clip_draft_asset_unavailable'; end if;
  if p_content->>'backgroundAssetId' is not null and not exists (
    select 1 from public.media_assets where id=(p_content->>'backgroundAssetId')::uuid and user_id=p_user_id
      and collection='audio' and status='ready' and deleted_at is null and coalesce(metadata->>'testOnly','false') <> 'true'
  ) then raise exception 'clip_draft_asset_unavailable'; end if;
  if p_content->'workflowMusic'->>'assetId' is not null and not exists (
    select 1 from public.media_assets where id=(p_content->'workflowMusic'->>'assetId')::uuid and user_id=p_user_id
      and collection='audio' and status='ready' and deleted_at is null and coalesce(metadata->>'testOnly','false') <> 'true'
  ) then raise exception 'clip_draft_asset_unavailable'; end if;
  trim_start := (p_content->'editing'->>'trimStartMs')::numeric;
  trim_end := (p_content->'editing'->>'trimEndMs')::numeric;
  if trim_start < 0 or trim_end > 120000 or trim_start <> trunc(trim_start) or trim_end <> trunc(trim_end) or
     trim_end-trim_start < 1000 or (source_duration > 0 and trim_end > source_duration*1000 + 50) then raise exception 'clip_draft_invalid'; end if;
  if saved.id is null then
    insert into public.explore_clip_drafts(user_id,scope,source_asset_id,revision,content)
      values(p_user_id,p_scope,p_source_asset_id,1,p_content) returning * into saved;
  elsif saved.content is distinct from p_content then
    update public.explore_clip_drafts set content=p_content,revision=revision+1,updated_at=clock_timestamp()
      where id=saved.id returning * into saved;
  end if;
  accepted := jsonb_build_object('id',saved.id,'scope',saved.scope,'revision',saved.revision,'content',saved.content,'updatedAt',saved.updated_at);
  insert into public.explore_clip_draft_saves(user_id,request_id,scope,source_asset_id,expected_revision,content,accepted_draft)
    values(p_user_id,p_request_id,p_scope,p_source_asset_id,p_expected_revision,p_content,accepted);
  return jsonb_build_object('user_id',p_user_id,'request_id',p_request_id,'draft',accepted,'replayed',false);
end; $$;
revoke all on function public.explore_save_clip_draft(text,text,uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.explore_save_clip_draft(text,text,uuid,uuid,bigint,jsonb) to service_role;
