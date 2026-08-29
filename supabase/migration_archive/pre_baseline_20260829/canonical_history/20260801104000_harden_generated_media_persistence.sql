create table if not exists public.generation_provider_operations (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.background_jobs(id) on delete cascade,
  operation_key text not null
    check (char_length(trim(operation_key)) between 1 and 120),
  provider text not null
    check (provider in ('openai', 'runway', 'veo')),
  status text not null default 'reserved'
    check (
      status in (
        'reserved',
        'submitted',
        'provider_succeeded',
        'output_persisted',
        'failed',
        'submission_uncertain'
      )
    ),
  request_fingerprint text not null
    check (request_fingerprint ~ '^[a-f0-9]{64}$'),
  provider_operation_id text,
  output_reference text,
  output_url text
    check (output_url is null or output_url ~ '^https?://'),
  retry_allowed boolean not null default false,
  last_error_code text,
  last_error_message text,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  submitted_at timestamptz,
  provider_completed_at timestamptz,
  output_persisted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, operation_key)
);

create unique index if not exists generation_provider_operations_provider_id_uidx
  on public.generation_provider_operations (provider, provider_operation_id)
  where provider_operation_id is not null;

create index if not exists generation_provider_operations_job_updated_idx
  on public.generation_provider_operations (job_id, updated_at desc);

create index if not exists generation_provider_operations_uncertain_idx
  on public.generation_provider_operations (updated_at, job_id)
  where status in ('reserved', 'submission_uncertain');

alter table public.generation_provider_operations enable row level security;

revoke all privileges on table public.generation_provider_operations
  from public, anon, authenticated;
grant select, insert, update on table public.generation_provider_operations
  to service_role;

create or replace function public.complete_background_job(
  p_job_id uuid,
  p_claim_token uuid,
  p_output jsonb,
  p_output_reference text default null
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current public.background_jobs%rowtype;
  v_output jsonb := coalesce(p_output, '{}'::jsonb);
  v_now timestamptz := now();
  v_asset_id uuid;
  v_collection text;
  v_source_type text;
  v_title text;
  v_mime_type text;
  v_storage_key text;
  v_url text;
  v_thumbnail_url text;
  v_ratio text;
  v_width integer;
  v_height integer;
  v_duration_seconds numeric;
  v_file_size_bytes bigint;
begin
  if p_claim_token is null then
    raise exception 'claim token is required';
  end if;

  if p_output is null or jsonb_typeof(p_output) <> 'object' then
    raise exception 'background job output must be an object';
  end if;

  select job.*
  into v_current
  from public.background_jobs as job
  where job.id = p_job_id
    and job.claim_token = p_claim_token
    and job.status in (
      'processing',
      'waiting_external_service',
      'rendering',
      'uploading_output'
    )
  for update;

  if not found then
    return;
  end if;

  if v_current.job_type in (
    'generate_avatar',
    'generate_hook_video',
    'generate_image'
  ) then
    if v_current.user_id is null or char_length(trim(v_current.user_id)) = 0 then
      raise exception 'generated media job requires an owner';
    end if;

    v_storage_key := nullif(trim(p_output ->> 'key'), '');
    v_url := nullif(trim(p_output ->> 'url'), '');

    if v_storage_key is null then
      raise exception 'generated media output requires a storage key';
    end if;

    if v_url is null or v_url !~ '^https?://' then
      raise exception 'generated media output requires an HTTP URL';
    end if;

    v_collection := case
      when v_current.job_type = 'generate_hook_video' then 'video'
      else 'image'
    end;
    v_source_type := case
      when v_current.job_type = 'generate_hook_video' then 'generated_video'
      else 'generated_image'
    end;
    v_title := case
      when v_current.job_type = 'generate_hook_video' then 'Generated influencer video'
      when v_current.job_type = 'generate_avatar' then 'Generated influencer image'
      else 'Generated image'
    end;
    v_mime_type := case
      when v_current.job_type = 'generate_hook_video' then 'video/mp4'
      else 'image/png'
    end;
    v_thumbnail_url := case
      when v_current.job_type = 'generate_hook_video'
        and coalesce(p_output ->> 'thumbnailUrl', '') ~ '^https?://'
        then p_output ->> 'thumbnailUrl'
      when v_current.job_type <> 'generate_hook_video' then v_url
      else null
    end;
    v_ratio := case
      when p_output ->> 'ratio' in ('9:16', '1:1', '4:5', '16:9', 'other')
        then p_output ->> 'ratio'
      when v_current.input_json ->> 'aspectRatio' in ('9:16', '1:1', '4:5', '16:9', 'other')
        then v_current.input_json ->> 'aspectRatio'
      else 'other'
    end;
    v_width := case
      when coalesce(p_output ->> 'width', '') ~ '^[1-9][0-9]*$'
        then (p_output ->> 'width')::integer
      else null
    end;
    v_height := case
      when coalesce(p_output ->> 'height', '') ~ '^[1-9][0-9]*$'
        then (p_output ->> 'height')::integer
      else null
    end;
    v_duration_seconds := case
      when coalesce(p_output ->> 'durationSeconds', '') ~ '^[0-9]+([.][0-9]+)?$'
        then (p_output ->> 'durationSeconds')::numeric
      else null
    end;
    v_file_size_bytes := case
      when coalesce(p_output ->> 'fileSizeBytes', '') ~ '^[1-9][0-9]*$'
        then (p_output ->> 'fileSizeBytes')::bigint
      else null
    end;

    select asset.id
    into v_asset_id
    from public.media_assets as asset
    where asset.user_id = v_current.user_id
      and asset.deleted_at is null
      and (
        (
          asset.source_type = v_source_type
          and asset.source_record_id = v_current.id::text
        )
        or asset.storage_key = v_storage_key
      )
    order by
      case
        when asset.source_type = v_source_type
          and asset.source_record_id = v_current.id::text then 0
        else 1
      end,
      asset.created_at
    limit 1
    for update;

    if v_asset_id is null then
      v_asset_id := gen_random_uuid();

      insert into public.media_assets (
        id,
        user_id,
        project_id,
        collection,
        source_type,
        source_record_id,
        parent_asset_id,
        title,
        storage_key,
        url,
        thumbnail_url,
        mime_type,
        file_name,
        file_size_bytes,
        duration_seconds,
        width,
        height,
        ratio,
        status,
        metadata,
        created_at,
        updated_at
      ) values (
        v_asset_id,
        v_current.user_id,
        v_current.project_id,
        v_collection,
        v_source_type,
        v_current.id::text,
        null,
        v_title,
        v_storage_key,
        v_url,
        v_thumbnail_url,
        v_mime_type,
        null,
        v_file_size_bytes,
        v_duration_seconds,
        v_width,
        v_height,
        v_ratio,
        'ready',
        jsonb_build_object(
          'backgroundJobId', v_current.id::text,
          'jobType', v_current.job_type,
          'provider', p_output ->> 'provider'
        ),
        v_now,
        v_now
      );
    else
      update public.media_assets as asset
      set
        user_id = v_current.user_id,
        project_id = v_current.project_id,
        collection = v_collection,
        source_type = v_source_type,
        source_record_id = v_current.id::text,
        title = v_title,
        storage_key = v_storage_key,
        url = v_url,
        thumbnail_url = v_thumbnail_url,
        mime_type = v_mime_type,
        file_size_bytes = v_file_size_bytes,
        duration_seconds = v_duration_seconds,
        width = v_width,
        height = v_height,
        ratio = v_ratio,
        status = 'ready',
        metadata = coalesce(asset.metadata, '{}'::jsonb) || jsonb_build_object(
          'backgroundJobId', v_current.id::text,
          'jobType', v_current.job_type,
          'provider', p_output ->> 'provider'
        ),
        updated_at = v_now
      where asset.id = v_asset_id;
    end if;

    v_output := v_output || jsonb_build_object('mediaAssetId', v_asset_id::text);
  end if;

  update public.background_jobs as job
  set
    status = 'completed',
    stage = 'completed',
    progress = 100,
    output_json = v_output,
    output_reference = coalesce(nullif(trim(p_output_reference), ''), job.output_reference),
    error_code = null,
    error_message = null,
    next_attempt_at = null,
    completed_at = v_now,
    failed_at = null,
    claim_token = null,
    locked_at = null,
    worker_id = null,
    worker_execution_id = null,
    updated_at = v_now
  where job.id = p_job_id;

  perform public.append_background_job_event(
    p_job_id,
    'job_completed',
    jsonb_strip_nulls(
      jsonb_build_object(
        'fromStatus', v_current.status,
        'mediaAssetId', v_asset_id,
        'outputReference', p_output_reference
      )
    )
  );

  return query
  select job.*
  from public.background_jobs as job
  where job.id = p_job_id;
end;
$$;

revoke all on function public.complete_background_job(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.complete_background_job(uuid, uuid, jsonb, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
