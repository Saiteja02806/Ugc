-- Additive Explore finishing receipts. Firebase ownership is verified in the
-- server API; database access is service-only, with RLS as defense in depth.
create table public.explore_video_finishes (
  user_id text not null,
  request_key uuid not null,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  draft jsonb not null check (jsonb_typeof(draft) = 'object'),
  job_id uuid not null unique references public.background_jobs(id),
  output_asset_id uuid not null unique,
  status text not null default 'queued' check (status in ('queued','completed','uncertain')),
  speech_hash text check (speech_hash ~ '^[0-9a-f]{64}$'),
  speech_duration_ms integer check (speech_duration_ms > 0 and speech_duration_ms <= 60000),
  transcription_provider_key text check (length(transcription_provider_key) between 1 and 128),
  transcription_started_at timestamptz,
  transcript jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, request_key)
);
create index explore_video_finishes_owner_created on public.explore_video_finishes(user_id, created_at desc);
create index explore_video_finishes_speech on public.explore_video_finishes(user_id, speech_hash) where transcript is not null;
alter table public.explore_video_finishes enable row level security;
revoke all on public.explore_video_finishes from public, anon, authenticated;
grant select, insert, update on public.explore_video_finishes to service_role;

create function public.explore_create_video_finish(p_user_id text, p_request_key uuid, p_fingerprint text, p_draft jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved public.explore_video_finishes%rowtype;
  created_job jsonb;
  output_id uuid := gen_random_uuid();
  selected_id text;
  expected_collection text;
begin
  if p_user_id is null or length(p_user_id) not between 1 and 128 or p_request_key is null or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$'
     or p_draft is null or jsonb_typeof(p_draft) <> 'object' or coalesce(p_draft->>'version','') <> '1' or coalesce(p_draft->>'kind','') not in ('hook','phone') then
    raise exception 'explore_finish_invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('explore-finish:' || p_user_id, 0));
  select * into saved from public.explore_video_finishes where user_id=p_user_id and request_key=p_request_key for update;
  if found then
    if saved.fingerprint <> p_fingerprint or saved.draft <> p_draft then raise exception 'explore_finish_conflict'; end if;
    return to_jsonb(saved);
  end if;
  -- Replay precedes availability checks: a saved request is never recreated
  -- just because a selected source was subsequently removed.
  for selected_id, expected_collection in
    select p_draft->>'sourceAssetId','video' union all select p_draft->>'demoAssetId','video'
    union all select p_draft->>'demoAudioAssetId','audio' union all select p_draft->>'backgroundAssetId','audio'
  loop
    if selected_id is not null and not exists (select 1 from public.media_assets
      where id=selected_id::uuid and user_id=p_user_id and collection=expected_collection and status='ready' and deleted_at is null) then
      raise exception 'explore_finish_asset_unavailable';
    end if;
  end loop;
  if p_draft->>'sourceAssetId' is null or (p_draft->>'demoAudioAssetId' is not null and p_draft->>'demoAssetId' is null) then raise exception 'explore_finish_invalid'; end if;
  -- Bound concurrent CPU work per owner without changing shared queue capacity.
  if exists (select 1 from public.explore_video_finishes f join public.background_jobs j on j.id=f.job_id
    where f.user_id=p_user_id and j.status not in ('completed','failed','cancelled')) then raise exception 'explore_finish_busy'; end if;
  created_job := public.create_or_get_background_job_v1(
    'explore-finish:' || p_request_key::text,
    jsonb_build_object('version',1,'userId',p_user_id,'requestKey',p_request_key,'fingerprint',p_fingerprint,'outputAssetId',output_id),
    null,'render_demo_video',3,'explore','video-render',p_user_id);
  if coalesce((created_job->>'created')::boolean,false) is not true then raise exception 'explore_finish_conflict'; end if;
  insert into public.explore_video_finishes(user_id,request_key,fingerprint,draft,job_id,output_asset_id)
    values(p_user_id,p_request_key,p_fingerprint,p_draft,(created_job->'job'->>'id')::uuid,output_id) returning * into saved;
  return to_jsonb(saved);
end;
$$;

create function public.explore_claim_transcription(p_user_id text, p_request_key uuid, p_job_id uuid, p_claim_token uuid, p_speech_hash text, p_duration_ms integer, p_provider_key text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare saved public.explore_video_finishes%rowtype; cached jsonb;
begin
  -- Match the current worker lease BEFORE reading cached speech or making a
  -- paid-provider claim. A stale/cancelled delivery cannot start new work.
  perform 1 from public.background_jobs where id=p_job_id and user_id=p_user_id and job_type='render_demo_video'
    and claim_token=p_claim_token and status in ('processing','rendering','waiting_external_service','uploading_output') for update;
  if not found then raise exception 'explore_finish_lease_lost'; end if;
  select * into saved from public.explore_video_finishes where user_id=p_user_id and request_key=p_request_key and job_id=p_job_id for update;
  if not found or saved.draft->'subtitles' is null or saved.draft->'subtitles' = 'null'::jsonb
     or p_speech_hash is null or p_speech_hash !~ '^[0-9a-f]{64}$' or p_duration_ms is null or p_duration_ms not between 1 and 60000
     or p_provider_key is null or p_provider_key <> 'elevenlabs:scribe_v2:auto:en:word:v1' then raise exception 'explore_finish_invalid'; end if;
  if saved.speech_hash is not null and (saved.speech_hash<>p_speech_hash or saved.speech_duration_ms<>p_duration_ms
      or saved.transcription_provider_key is distinct from p_provider_key) then raise exception 'explore_finish_source_changed'; end if;
  if saved.transcript is not null then return jsonb_build_object('state','ready','transcript',saved.transcript); end if;
  if saved.transcription_started_at is not null then
    update public.explore_video_finishes set status='uncertain',updated_at=now() where user_id=p_user_id and request_key=p_request_key;
    return jsonb_build_object('state','uncertain');
  end if;
  -- Serialize identical speech across requests. A new edit after a timeout
  -- must not bypass the unresolved paid claim from the previous edit.
  perform pg_advisory_xact_lock(hashtextextended('explore-speech:' || p_user_id || ':' || p_speech_hash || ':' || p_provider_key,0));
  -- Reuse only this owner's exact speech AND adapter policy, never an old model.
  select transcript into cached from public.explore_video_finishes
    where user_id=p_user_id and speech_hash=p_speech_hash and speech_duration_ms=p_duration_ms
      and transcription_provider_key=p_provider_key and transcript is not null limit 1;
  if cached is null and exists (select 1 from public.explore_video_finishes where user_id=p_user_id
      and speech_hash=p_speech_hash and speech_duration_ms=p_duration_ms and transcription_provider_key=p_provider_key
      and transcription_started_at is not null and transcript is null) then
    update public.explore_video_finishes set speech_hash=p_speech_hash,speech_duration_ms=p_duration_ms,
      transcription_provider_key=p_provider_key,status='uncertain',updated_at=now() where user_id=p_user_id and request_key=p_request_key;
    return jsonb_build_object('state','uncertain');
  end if;
  update public.explore_video_finishes set speech_hash=p_speech_hash,speech_duration_ms=p_duration_ms,
    transcription_provider_key=p_provider_key,transcript=cached,status='queued',
    transcription_started_at=case when cached is null then now() else null end,updated_at=now()
    where user_id=p_user_id and request_key=p_request_key;
  return case when cached is null then jsonb_build_object('state','submit') else jsonb_build_object('state','ready','transcript',cached) end;
end;
$$;

create function public.explore_save_transcription(p_user_id text,p_request_key uuid,p_job_id uuid,p_speech_hash text,p_duration_ms integer,p_transcript jsonb,p_provider_key text)
returns boolean language plpgsql security invoker set search_path = '' as $$
begin
  -- A late provider response may repair an uncertain receipt, but must match
  -- the paid claim's exact owner, source and duration. It cannot publish video.
  if p_transcript is null or jsonb_typeof(p_transcript) <> 'object' or coalesce(p_transcript->>'provider','') <> 'elevenlabs'
     or coalesce(p_transcript->>'model','') <> 'scribe_v2' or coalesce(p_transcript->>'schemaVersion','') <> '1'
     or p_provider_key is null or p_provider_key <> 'elevenlabs:scribe_v2:auto:en:word:v1'
     or p_duration_ms is null or p_duration_ms not between 1 and 60000 or coalesce((p_transcript->>'durationMs')::integer,0) <> p_duration_ms
     or coalesce(p_transcript->>'language','') <> 'en' or coalesce(jsonb_typeof(p_transcript->'words'),'') <> 'array'
     or jsonb_array_length(p_transcript->'words') not between 1 and 2000 then raise exception 'explore_finish_invalid'; end if;
  update public.explore_video_finishes set transcript=p_transcript,status='queued',updated_at=now()
    where user_id=p_user_id and request_key=p_request_key and job_id=p_job_id and speech_hash=p_speech_hash
      and speech_duration_ms=p_duration_ms and transcription_provider_key=p_provider_key
      and transcription_started_at is not null and transcript is null and status<>'completed';
  return found;
end;
$$;

create function public.explore_finalize_video_finish(p_user_id text,p_request_key uuid,p_job_id uuid,p_claim_token uuid,p_output jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare saved public.explore_video_finishes%rowtype; asset_id uuid;
begin
  perform 1 from public.background_jobs where id=p_job_id and user_id=p_user_id and job_type='render_demo_video'
    and claim_token=p_claim_token and status in ('processing','rendering','waiting_external_service','uploading_output') for update;
  if not found then raise exception 'explore_finish_lease_lost'; end if;
  select * into saved from public.explore_video_finishes where user_id=p_user_id and request_key=p_request_key and job_id=p_job_id for update;
  if not found or saved.status='uncertain' or (saved.draft->'subtitles'<>'null'::jsonb and saved.transcript is null) then raise exception 'explore_finish_not_ready'; end if;
  if p_output is null or coalesce(p_output->>'storageKey','') <> 'explore/finishes/' || saved.output_asset_id::text || '/video.mp4'
    or coalesce(p_output->>'url','') !~ '^https://'
    or coalesce(p_output->>'ratio','') not in ('9:16','16:9','4:5','1:1','other')
    or coalesce((p_output->>'durationSeconds')::numeric,0) not between 0.001 and 240
    or coalesce((p_output->>'fileSizeBytes')::bigint,0) not between 1 and 262144000
    or coalesce((p_output->>'width')::integer,0) not between 64 and 4096
    or coalesce((p_output->>'height')::integer,0) not between 64 and 4096 then raise exception 'explore_finish_invalid'; end if;
  if saved.status='completed' then
    select id into asset_id from public.media_assets where id=saved.output_asset_id and user_id=p_user_id and status='ready' and deleted_at is null;
    if not found then raise exception 'explore_finish_output_unavailable'; end if;
    return asset_id;
  end if;
  insert into public.media_assets(id,user_id,collection,source_type,source_record_id,parent_asset_id,project_id,title,mime_type,status,
    storage_key,url,ratio,duration_seconds,file_size_bytes,width,height,metadata)
    values(saved.output_asset_id,p_user_id,'video','combined_render',p_job_id::text,(saved.draft->>'sourceAssetId')::uuid,'explore','Finished Explore video','video/mp4','ready',
      p_output->>'storageKey',p_output->>'url',p_output->>'ratio',(p_output->>'durationSeconds')::numeric,(p_output->>'fileSizeBytes')::bigint,
      (p_output->>'width')::integer,(p_output->>'height')::integer,
      jsonb_build_object('exploreFinish',true,'requestKey',p_request_key,'fingerprint',saved.fingerprint,'draft',saved.draft,'render',p_output->'metadata'))
    returning id into asset_id;
  update public.explore_video_finishes set status='completed',updated_at=now() where user_id=p_user_id and request_key=p_request_key;
  return asset_id;
end;
$$;

-- Extend the CURRENT bounded renderer lease function, retaining all newer main
-- fixes. Fail closed if its expected narrow job-type predicate has changed.
do $$
declare definition text; replacement text;
begin
  select pg_get_functiondef('public.claim_video_render_execution_slot(uuid,uuid,integer)'::regprocedure) into definition;
  if position('''render_demo_video''' in definition)=0 then
    if length(definition)-length(replace(definition,'''render_edit_video''','')) <> length('''render_edit_video''') then
      raise exception 'Explore finish: review the current render lease function before applying this migration';
    end if;
    replacement := replace(definition,'''render_edit_video''','''render_demo_video'', ''render_edit_video''');
    execute replacement;
  end if;
end;
$$;

revoke all on function public.explore_create_video_finish(text,uuid,text,jsonb),
  public.explore_claim_transcription(text,uuid,uuid,uuid,text,integer,text),
  public.explore_save_transcription(text,uuid,uuid,text,integer,jsonb,text),
  public.explore_finalize_video_finish(text,uuid,uuid,uuid,jsonb) from public, anon, authenticated;
grant execute on function public.explore_create_video_finish(text,uuid,text,jsonb),
  public.explore_claim_transcription(text,uuid,uuid,uuid,text,integer,text),
  public.explore_save_transcription(text,uuid,uuid,text,integer,jsonb,text),
  public.explore_finalize_video_finish(text,uuid,uuid,uuid,jsonb) to service_role;
