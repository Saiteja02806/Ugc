-- Persist the private location in the SAME transaction as the reservation.
-- Reuse the existing quota lock/idempotency contract and leave legacy signatures unchanged.
create function public.mcp_reserve_private_upload(
  p_user_id text, p_request_id uuid, p_fingerprint text,
  p_asset_id uuid, p_collection text, p_source_type text, p_file_name text,
  p_file_size_bytes bigint, p_mime_type text, p_storage_key text,
  p_title text, p_url text
) returns jsonb language plpgsql security invoker set search_path = '' as $function$
declare v_asset public.media_assets%rowtype; v_existing boolean; v_result jsonb;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('mcp-upload:' || p_user_id, 0));
  select exists(select 1 from public.media_assets where user_id=p_user_id
    and metadata->>'mcpUpload'='true' and metadata->>'mcpUploadRequestKey'=p_request_id::text) into v_existing;
  -- A replay may predate rollout. Never retag or relocate that original object.
  v_result := public.mcp_reserve_upload(p_user_id,p_request_id,p_fingerprint,p_asset_id,
    p_collection,p_source_type,p_file_name,p_file_size_bytes,p_mime_type,p_storage_key,p_title,p_url);
  if v_existing then return v_result; end if;
  if p_url !~ '^https://storage\.googleapis\.com/[a-z0-9][a-z0-9_-]{1,61}[a-z0-9]/media/'
    or pg_catalog.right(p_url,pg_catalog.length(p_storage_key)+1) <> '/' || p_storage_key then
    raise exception 'mcp_upload_input_invalid';
  end if;
  update public.media_assets set metadata=metadata || pg_catalog.jsonb_build_object('storageLocation','private_user_media')
    where id=p_asset_id and user_id=p_user_id returning * into v_asset;
  if not found then raise exception 'mcp_upload_not_found'; end if;
  return pg_catalog.to_jsonb(v_asset);
end;
$function$;
revoke all on function public.mcp_reserve_private_upload(text,uuid,text,uuid,text,text,text,bigint,text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.mcp_reserve_private_upload(text,uuid,text,uuid,text,text,text,bigint,text,text,text,text)
  to service_role;
select pg_notify('pgrst','reload schema');
