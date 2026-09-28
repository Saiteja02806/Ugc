-- Keep MCP upload reservations bounded per account. Owner-deleted,
-- unconfirmed rows continue to count until their object cleanup succeeds.
-- Confirmation itself has no deadline.
create index if not exists media_assets_mcp_unconfirmed_quota_idx
  on public.media_assets (user_id)
  where status = 'uploading'
    and metadata->>'mcpUpload' = 'true'
    and (deleted_at is null or metadata->>'mcpUploadCleanupComplete' is distinct from 'true');

create function public.mcp_create_upload_asset(
  p_user_id text,
  p_asset_id uuid,
  p_collection text,
  p_source_type text,
  p_file_name text,
  p_file_size_bytes bigint,
  p_mime_type text,
  p_storage_key text,
  p_title text,
  p_url text,
  p_max_unconfirmed_count integer,
  p_max_unconfirmed_bytes bigint
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_active_count bigint;
  v_active_bytes bigint;
  v_asset public.media_assets%rowtype;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null
     or p_asset_id is null
     or p_collection is null or p_collection not in ('image', 'video', 'influencer')
     or (p_collection = 'influencer' and p_source_type is distinct from 'influencer_upload')
     or (p_collection <> 'influencer' and p_source_type is distinct from 'upload')
     or nullif(pg_catalog.btrim(p_file_name), '') is null
     or pg_catalog.length(p_file_name) > 255
     or p_file_size_bytes is null or p_file_size_bytes < 1
     or (p_collection = 'image' and p_file_size_bytes > 26214400)
     or (p_collection <> 'image' and p_file_size_bytes > 262144000)
     or nullif(pg_catalog.btrim(p_mime_type), '') is null
     or (p_collection = 'image' and p_mime_type not in
       ('image/jpeg', 'image/png', 'image/webp'))
     or (p_collection <> 'image' and p_mime_type not in
       ('video/mp4', 'video/quicktime', 'video/webm'))
     or nullif(pg_catalog.btrim(p_storage_key), '') is null
     or pg_catalog.strpos(p_storage_key, p_asset_id::text) = 0
     or nullif(pg_catalog.btrim(p_title), '') is null
     or pg_catalog.length(p_title) > 140
     or p_url is null or p_url !~ '^https://'
     or p_max_unconfirmed_count is null or p_max_unconfirmed_count not between 1 and 100
     or p_max_unconfirmed_bytes is null or p_max_unconfirmed_bytes < 262144000
     or p_max_unconfirmed_bytes > 10737418240 then
    raise exception 'mcp_upload_input_invalid';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('mcp-upload:' || p_user_id, 0)
  );

  select pg_catalog.count(*), coalesce(pg_catalog.sum(file_size_bytes), 0)
    into v_active_count, v_active_bytes
  from public.media_assets
  where user_id = p_user_id
    and status = 'uploading'
    and metadata->>'mcpUpload' = 'true'
    and (deleted_at is null or metadata->>'mcpUploadCleanupComplete' is distinct from 'true');

  if v_active_count >= p_max_unconfirmed_count
     or v_active_bytes > p_max_unconfirmed_bytes - p_file_size_bytes then
    raise exception 'mcp_upload_quota_exceeded';
  end if;

  insert into public.media_assets (
    id, user_id, collection, source_type, source_record_id, title,
    storage_key, url, mime_type, file_name, file_size_bytes, ratio,
    status, metadata, updated_at
  ) values (
    p_asset_id, p_user_id, p_collection, p_source_type, p_asset_id::text,
    p_title, p_storage_key, p_url, p_mime_type, p_file_name,
    p_file_size_bytes, 'other', 'uploading',
    pg_catalog.jsonb_build_object('mcpUpload', true), now()
  ) returning * into v_asset;

  return pg_catalog.to_jsonb(v_asset);
end;
$function$;

revoke all on function public.mcp_create_upload_asset(
  text, uuid, text, text, text, bigint, text, text, text, text, integer, bigint
) from public, anon, authenticated;
grant execute on function public.mcp_create_upload_asset(
  text, uuid, text, text, text, bigint, text, text, text, text, integer, bigint
) to service_role;

-- Claim only owner-deleted MCP uploads after their signed links have expired.
-- The short lease lets a later request retry cleanup if a function crashes.
create function public.mcp_claim_deleted_upload_cleanup(
  p_user_id text,
  p_claim_token uuid,
  p_deleted_before timestamptz,
  p_limit integer
) returns setof public.media_assets
language sql
security definer
set search_path = ''
as $function$
  with candidates as (
    select id from public.media_assets
    where user_id = p_user_id
      and status = 'uploading'
      and deleted_at is not null
      and deleted_at <= p_deleted_before
      and metadata->>'mcpUpload' = 'true'
      and metadata->>'mcpUploadCleanupComplete' is distinct from 'true'
      and (metadata->>'mcpUploadCleanupClaimToken' is null
        or updated_at < now() - interval '5 minutes')
      and nullif(pg_catalog.btrim(p_user_id), '') is not null
      and p_claim_token is not null
      and p_deleted_before < now()
      and p_limit between 1 and 10
    order by deleted_at
    for update skip locked
    limit p_limit
  )
  update public.media_assets as asset
  set metadata = asset.metadata || pg_catalog.jsonb_build_object(
        'mcpUploadCleanupClaimToken', p_claim_token::text
      ),
      updated_at = now()
  from candidates
  where asset.id = candidates.id
  returning asset.*;
$function$;

create function public.mcp_finish_deleted_upload_cleanup(
  p_user_id text,
  p_asset_id uuid,
  p_claim_token uuid
) returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
begin
  update public.media_assets
  set metadata = (metadata - 'mcpUploadCleanupClaimToken') ||
      pg_catalog.jsonb_build_object('mcpUploadCleanupComplete', true),
      updated_at = now()
  where user_id = p_user_id
    and id = p_asset_id
    and status = 'uploading'
    and deleted_at is not null
    and metadata->>'mcpUpload' = 'true'
    and metadata->>'mcpUploadCleanupComplete' is distinct from 'true'
    and metadata->>'mcpUploadCleanupClaimToken' = p_claim_token::text;
  return found;
end;
$function$;

revoke all on function public.mcp_claim_deleted_upload_cleanup(text, uuid, timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.mcp_claim_deleted_upload_cleanup(text, uuid, timestamptz, integer)
  to service_role;
revoke all on function public.mcp_finish_deleted_upload_cleanup(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.mcp_finish_deleted_upload_cleanup(text, uuid, uuid)
  to service_role;

select pg_notify('pgrst', 'reload schema');
