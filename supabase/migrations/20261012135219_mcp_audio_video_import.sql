-- Saved audio becomes an independent Explore media snapshot, as in the website.
-- Service-only: clients supply neither owner nor storage identity. Existing MCP
-- request uniqueness, pending quota and cleanup leases also apply to these rows.
create function public.mcp_reserve_audio_import(
  p_user_id text, p_request_id uuid, p_source_id uuid, p_asset_id uuid,
  p_storage_key text, p_url text, p_private boolean, p_snapshot jsonb
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved public.media_assets%rowtype;
  source public.audio_assets%rowtype;
  snapshot jsonb;
  canonical_mime text;
  active_count bigint;
  active_bytes bigint;
begin
  if p_user_id is null or length(p_user_id) not between 1 and 128 or p_request_id is null or p_source_id is null then
    raise exception 'mcp_audio_import_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('mcp-upload:' || p_user_id,0));
  select * into saved from public.media_assets where user_id=p_user_id
    and metadata->>'mcpUpload'='true' and metadata->>'mcpUploadRequestKey'=p_request_id::text for update;
  -- Recovery keeps the original location and source snapshot, even if a gate
  -- changes or the original recording is retired after its bytes were copied.
  if found then
    if saved.metadata->>'mcpAudioImport' is distinct from 'true'
      or saved.metadata->>'mcpAudioSourceId' is distinct from p_source_id::text then
      raise exception 'mcp_audio_import_conflict';
    end if;
    if saved.deleted_at is not null then raise exception 'mcp_audio_import_removed'; end if;
    return to_jsonb(saved);
  end if;
  select * into source from public.audio_assets where user_id=p_user_id and id=p_source_id for update;
  if not found or source.status <> 'ready' or source.test_only is distinct from false
    or source.purpose not in ('generated','exact') or source.duration_seconds is null
    or source.duration_seconds <= 0 or source.duration_seconds > 180
    or source.size_bytes not between 32 and 12582912 or source.checksum is null
    or source.checksum !~ '^[a-f0-9]{64}$' then raise exception 'mcp_audio_source_unavailable'; end if;
  snapshot := jsonb_build_object('sha256',source.checksum,'size',source.size_bytes,
    'mime_type',source.mime_type,'duration_seconds',source.duration_seconds,
    'object_identity',encode(sha256(convert_to(source.object_key,'UTF8')),'hex'));
  if p_snapshot is distinct from snapshot then raise exception 'mcp_audio_source_changed'; end if;
  canonical_mime := case source.mime_type when 'audio/mp3' then 'audio/mpeg'
    when 'audio/x-wav' then 'audio/wav' when 'audio/x-m4a' then 'audio/mp4' else source.mime_type end;
  if canonical_mime not in ('audio/mpeg','audio/wav','audio/mp4','audio/ogg','audio/webm')
    or p_asset_id is null or p_storage_key is null
    or p_storage_key !~ ('^media/[A-Za-z0-9_-]+/audio/' || p_asset_id::text || '\.(mp3|wav|m4a|ogg|webm)$')
    or p_url is null or p_url !~ '^https://' or p_private is null
    or (p_private and (p_url !~ '^https://storage\.googleapis\.com/[A-Za-z0-9._-]+/media/'
      or right(p_url,length(p_storage_key)+1) <> '/' || p_storage_key)) then
    raise exception 'mcp_audio_import_invalid';
  end if;
  select count(*),coalesce(sum(file_size_bytes),0) into active_count,active_bytes
    from public.media_assets where user_id=p_user_id and status='uploading' and metadata->>'mcpUpload'='true'
    and (deleted_at is null or metadata->>'mcpUploadCleanupComplete' is distinct from 'true');
  if active_count >= 5 or active_bytes + source.size_bytes > 524288000 then raise exception 'mcp_upload_quota_exceeded'; end if;
  insert into public.media_assets(id,user_id,collection,source_type,source_record_id,project_id,
    title,file_name,mime_type,file_size_bytes,storage_key,url,ratio,status,metadata)
    values(p_asset_id,p_user_id,'audio','upload',p_asset_id::text,'explore-demo',
      left(source.name,140),'saved-audio-' || p_source_id::text || substring(p_storage_key from '\.[^.]+$'),
      canonical_mime,source.size_bytes,p_storage_key,p_url,'other','uploading',
      jsonb_build_object('mcpUpload',true,'mcpUploadRequestKey',p_request_id::text,
        'mcpAudioImport',true,'mcpAudioSourceId',p_source_id::text,'mcpAudioSnapshot',snapshot,
        'mcpUploadUrlExpiresAt',now()+interval '10 minutes') ||
      case when p_private then jsonb_build_object('storageLocation','private_user_media') else '{}'::jsonb end)
    returning * into saved;
  return to_jsonb(saved);
end;
$$;

create function public.mcp_complete_audio_import(
  p_user_id text,p_request_id uuid,p_asset_id uuid,p_snapshot jsonb,
  p_generation text,p_duration_seconds numeric
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.media_assets%rowtype;
begin
  select * into saved from public.media_assets where id=p_asset_id and user_id=p_user_id
    and metadata->>'mcpUploadRequestKey'=p_request_id::text
    and metadata->>'mcpAudioImport'='true' and metadata->>'mcpUpload'='true' for update;
  if not found then raise exception 'mcp_audio_import_not_found'; end if;
  if saved.deleted_at is not null then raise exception 'mcp_audio_import_removed'; end if;
  if p_snapshot is distinct from saved.metadata->'mcpAudioSnapshot' or p_generation is null
    or p_generation !~ '^[1-9][0-9]{0,30}$' or p_duration_seconds is null
    or p_duration_seconds <= 0 or p_duration_seconds > 180
    or abs(p_duration_seconds-(p_snapshot->>'duration_seconds')::numeric)>0.25 then
    raise exception 'mcp_audio_import_invalid';
  end if;
  if saved.collection <> 'audio' or saved.source_type <> 'upload' or saved.project_id <> 'explore-demo'
    or saved.file_size_bytes <> (p_snapshot->>'size')::bigint then raise exception 'mcp_audio_import_invalid'; end if;
  if saved.status='ready' then
    if saved.metadata->>'mcpAudioObjectGeneration' is distinct from p_generation
      or saved.duration_seconds is distinct from p_duration_seconds then raise exception 'mcp_audio_import_conflict'; end if;
    return to_jsonb(saved);
  end if;
  if saved.status <> 'uploading' then raise exception 'mcp_audio_import_invalid'; end if;
  update public.media_assets set status='ready',duration_seconds=p_duration_seconds,
    metadata=metadata || jsonb_build_object('mcpAudioObjectGeneration',p_generation),updated_at=now()
    where id=saved.id returning * into saved;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.mcp_reserve_audio_import(text,uuid,uuid,uuid,text,text,boolean,jsonb) from public,anon,authenticated;
revoke all on function public.mcp_complete_audio_import(text,uuid,uuid,jsonb,text,numeric) from public,anon,authenticated;
grant execute on function public.mcp_reserve_audio_import(text,uuid,uuid,uuid,text,text,boolean,jsonb) to service_role;
grant execute on function public.mcp_complete_audio_import(text,uuid,uuid,jsonb,text,numeric) to service_role;
select pg_notify('pgrst', 'reload schema');
