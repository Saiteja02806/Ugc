-- Shared owner-aware operations for dedicated Demo records and their media.
-- Firebase identity is supplied only by trusted server adapters; these RPCs
-- are intentionally unavailable to anon/authenticated Data API callers.
create index if not exists demo_videos_mcp_page_idx
  on public.demo_videos (user_id, project_id, updated_at desc, id desc)
  where deleted_at is null;

create function public.mcp_register_demo(p_user_id text, p_asset_id uuid, p_project_id text)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare
  v_asset public.media_assets%rowtype;
  v_demo public.demo_videos%rowtype;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null or p_asset_id is null
     or p_project_id is null or p_project_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$' then
    raise exception 'mcp_demo_input_invalid';
  end if;
  -- All Demo mutations acquire media before Demo, so register/delete serialize.
  select * into v_asset from public.media_assets
    where id = p_asset_id and user_id = p_user_id for update;
  if not found or v_asset.deleted_at is not null then raise exception 'mcp_demo_not_found'; end if;
  select * into v_demo from public.demo_videos where id = p_asset_id for update;
  if found then
    if v_demo.user_id <> p_user_id or v_demo.project_id <> p_project_id
       or v_demo.source_s3_key <> v_asset.storage_key
       or v_asset.source_type <> 'demo_upload' or v_asset.project_id is distinct from p_project_id
       or v_asset.source_record_id is distinct from p_asset_id::text then
      raise exception 'mcp_demo_conflict';
    end if;
    if v_demo.deleted_at is not null then raise exception 'mcp_demo_not_found'; end if;
    -- Idempotent replay preserves subsequent website edits and render state.
    return pg_catalog.jsonb_build_object('demo_id', v_demo.id, 'asset_id', v_asset.id, 'project_id', v_demo.project_id);
  end if;
  if v_asset.collection <> 'video' or v_asset.status <> 'ready'
     or v_asset.source_type <> 'upload' or v_asset.metadata->>'mcpUpload' is distinct from 'true'
     or v_asset.file_name is null or v_asset.file_size_bytes is null
     or v_asset.file_size_bytes not between 1 and 104857600
     or v_asset.duration_seconds is null or v_asset.duration_seconds not between 1 and 60
     or v_asset.width is null or v_asset.width < 1 or v_asset.height is null or v_asset.height < 1
     or v_asset.mime_type not in ('video/mp4', 'video/quicktime', 'video/webm') then
    raise exception 'mcp_demo_input_invalid';
  end if;
  insert into public.demo_videos (
    id, user_id, project_id, title, source_s3_key, source_video_url, thumbnail_url,
    file_name, file_type, file_size_bytes, duration_seconds, width, height, ratio, status
  ) values (
    v_asset.id, p_user_id, p_project_id, v_asset.title, v_asset.storage_key, v_asset.url,
    v_asset.thumbnail_url, v_asset.file_name, v_asset.mime_type, v_asset.file_size_bytes,
    v_asset.duration_seconds, v_asset.width, v_asset.height, v_asset.ratio, 'ready'
  ) returning * into v_demo;
  update public.media_assets set source_type = 'demo_upload', project_id = p_project_id,
    source_record_id = p_asset_id::text,
    metadata = metadata || pg_catalog.jsonb_build_object('demoId', p_asset_id::text, 'mcpDemo', true),
    updated_at = now() where id = p_asset_id and user_id = p_user_id;
  return pg_catalog.jsonb_build_object('demo_id', v_demo.id, 'asset_id', v_asset.id, 'project_id', v_demo.project_id);
end;
$function$;

create function public.mcp_delete_demo(p_user_id text, p_demo_id uuid, p_project_id text)
returns boolean language plpgsql security invoker set search_path = '' as $function$
declare
  v_asset public.media_assets%rowtype;
  v_demo public.demo_videos%rowtype;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null or p_demo_id is null
     or p_project_id is null or p_project_id !~ '^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$' then
    raise exception 'mcp_demo_input_invalid';
  end if;
  select * into v_asset from public.media_assets
    where id = p_demo_id and user_id = p_user_id for update;
  select * into v_demo from public.demo_videos
    where id = p_demo_id and user_id = p_user_id and project_id = p_project_id for update;
  if not found then raise exception 'mcp_demo_not_found'; end if;
  if v_asset.id is not null and (v_asset.collection <> 'video'
     or v_asset.source_type <> 'demo_upload' or v_asset.project_id is distinct from p_project_id
     or v_asset.source_record_id is distinct from p_demo_id::text
     or v_asset.storage_key <> v_demo.source_s3_key) then
    raise exception 'mcp_demo_conflict';
  end if;
  update public.demo_videos set deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where id = p_demo_id and user_id = p_user_id and project_id = p_project_id and deleted_at is null;
  update public.media_assets set deleted_at = coalesce(deleted_at, now()), updated_at = now()
    where id = p_demo_id and user_id = p_user_id and deleted_at is null;
  -- Retain bytes for existing compositions/render jobs. Storage GC is separate.
  return true;
end;
$function$;

revoke all on function public.mcp_register_demo(text, uuid, text) from public, anon, authenticated;
revoke all on function public.mcp_delete_demo(text, uuid, text) from public, anon, authenticated;
grant execute on function public.mcp_register_demo(text, uuid, text) to service_role;
grant execute on function public.mcp_delete_demo(text, uuid, text) to service_role;

-- A generic media deletion can race registration after reading the old upload
-- classification. Propagate deletion inside the same database transaction,
-- including deletions made through the website's existing media service.
create function public.mcp_sync_registered_demo_deletion()
returns trigger language plpgsql security invoker set search_path = '' as $function$
begin
  if old.deleted_at is null and new.deleted_at is not null
     and new.source_type = 'demo_upload' and new.metadata->>'mcpDemo' = 'true' then
    update public.demo_videos set deleted_at = coalesce(deleted_at, new.deleted_at), updated_at = new.updated_at
      where id = new.id and user_id = new.user_id and project_id = new.project_id
        and source_s3_key = new.storage_key and deleted_at is null;
  end if;
  return new;
end;
$function$;
revoke all on function public.mcp_sync_registered_demo_deletion() from public, anon, authenticated;
grant execute on function public.mcp_sync_registered_demo_deletion() to service_role;
create trigger mcp_registered_demo_deleted
  after update of deleted_at on public.media_assets
  for each row execute function public.mcp_sync_registered_demo_deletion();
