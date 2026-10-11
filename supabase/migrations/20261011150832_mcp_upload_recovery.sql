-- Stable client request keys preserve reservations across lost responses.
-- Existing legacy creation/quota functions remain unchanged.
create unique index media_assets_mcp_upload_request_idx
  on public.media_assets (user_id, (metadata->>'mcpUploadRequestKey'))
  where metadata->>'mcpUpload' = 'true' and metadata->>'mcpUploadRequestKey' is not null;

create index media_assets_mcp_upload_page_idx
  on public.media_assets (user_id, updated_at desc, id desc)
  where deleted_at is null and metadata->>'mcpUpload' = 'true';

create function public.mcp_reserve_upload(
  p_user_id text, p_request_id uuid, p_fingerprint text,
  p_asset_id uuid, p_collection text, p_source_type text, p_file_name text,
  p_file_size_bytes bigint, p_mime_type text, p_storage_key text,
  p_title text, p_url text
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_asset public.media_assets%rowtype;
begin
  if nullif(pg_catalog.btrim(p_user_id), '') is null or p_request_id is null
    or p_fingerprint is null or p_fingerprint !~ '^[a-f0-9]{64}$' then
    raise exception 'mcp_upload_input_invalid';
  end if;
  -- Match the existing quota lock, including legacy reservations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mcp-upload:' || p_user_id, 0));
  select * into v_asset from public.media_assets
    where user_id = p_user_id and metadata->>'mcpUpload' = 'true'
      and metadata->>'mcpUploadRequestKey' = p_request_id::text for update;
  if found then
    if v_asset.metadata->>'mcpUploadFingerprint' is distinct from p_fingerprint then
      raise exception 'mcp_upload_request_conflict';
    end if;
    if v_asset.deleted_at is not null then raise exception 'mcp_upload_deleted'; end if;
    return pg_catalog.to_jsonb(v_asset);
  end if;
  perform public.mcp_create_upload_asset(p_user_id, p_asset_id, p_collection,
    p_source_type, p_file_name, p_file_size_bytes, p_mime_type, p_storage_key,
    p_title, p_url, 5, 524288000);
  update public.media_assets set metadata = metadata || pg_catalog.jsonb_build_object(
      'mcpUploadRequestKey', p_request_id::text, 'mcpUploadFingerprint', p_fingerprint)
    where id = p_asset_id and user_id = p_user_id returning * into v_asset;
  return pg_catalog.to_jsonb(v_asset);
end;
$function$;

-- Allocate expiry before signing; sign only for the remaining lease time.
-- A deletion cannot acquire a fresh lease. Old create-only URL cleanup grace
-- remains sufficient because no lease expires later than deletion + 10 min.
create function public.mcp_lease_upload_url(p_user_id text, p_asset_id uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_asset public.media_assets%rowtype;
begin
  select * into v_asset from public.media_assets where user_id = p_user_id
    and id = p_asset_id and deleted_at is null and metadata->>'mcpUpload' = 'true'
    and source_type in ('upload', 'influencer_upload') for update;
  if not found then raise exception 'mcp_upload_not_found'; end if;
  if v_asset.status <> 'uploading' then raise exception 'mcp_upload_already_confirmed'; end if;
  update public.media_assets set metadata = metadata || pg_catalog.jsonb_build_object(
      'mcpUploadUrlExpiresAt', pg_catalog.clock_timestamp() + interval '10 minutes'),
      updated_at = pg_catalog.clock_timestamp()
    where id = p_asset_id and user_id = p_user_id returning * into v_asset;
  return pg_catalog.to_jsonb(v_asset);
end;
$function$;

revoke all on function public.mcp_reserve_upload(text,uuid,text,uuid,text,text,text,bigint,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.mcp_reserve_upload(text,uuid,text,uuid,text,text,text,bigint,text,text,text,text)
  to service_role;
revoke all on function public.mcp_lease_upload_url(text,uuid) from public, anon, authenticated;
grant execute on function public.mcp_lease_upload_url(text,uuid) to service_role;
select pg_notify('pgrst', 'reload schema');

-- Respect the last recorded renewable URL lease before storage cleanup.
create or replace function public.mcp_claim_deleted_upload_cleanup(
  p_user_id text,
  p_claim_token uuid,
  p_deleted_before timestamptz,
  p_limit integer
) returns setof public.media_assets
language sql
security invoker
set search_path = ''
as $function$
  with candidates as (
    select id from public.media_assets
    where user_id = p_user_id
      and status = 'uploading'
      and deleted_at is not null
      and deleted_at <= p_deleted_before
      and (metadata->>'mcpUploadUrlExpiresAt' is null
        or (metadata->>'mcpUploadUrlExpiresAt')::timestamptz < now() - interval '1 minute')
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
