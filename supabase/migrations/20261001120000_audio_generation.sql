-- Audio is additive: separate owner-scoped records and private storage.
-- Do not make the existing image/video bucket or media collections private.
do $block$
declare v_definition text;
begin
  select pg_get_constraintdef(oid) into v_definition from pg_constraint
  where conrelid = 'public.background_jobs'::regclass and conname = 'background_jobs_job_type_check';
  if v_definition is not null and position('generate_audio' in v_definition) = 0 then
    alter table public.background_jobs drop constraint background_jobs_job_type_check;
    execute format('alter table public.background_jobs add constraint background_jobs_job_type_check check (job_type = %L or %s)',
      'generate_audio', regexp_replace(v_definition, '^CHECK \((.*)\)$', '\1'));
  end if;
  if exists (select 1 from storage.buckets where id = 'private-audio' and public) then
    raise exception 'private_audio_bucket_is_public';
  end if;
end;
$block$;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-audio', 'private-audio', false, 12582912,
  array['audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/mp4','audio/x-m4a','audio/ogg','audio/webm'])
on conflict (id) do nothing;
-- Existing broad permissive policies must not accidentally expose this bucket.
create policy private_audio_app_only on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'private-audio') with check (bucket_id <> 'private-audio');

create table public.audio_assets (
  id uuid primary key, user_id text not null, name text not null,
  purpose text not null check (purpose in ('generated','exact','reference')),
  object_key text not null unique, mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 12582912),
  duration_seconds numeric check (duration_seconds > 0 and duration_seconds <= 180),
  checksum text, status text not null default 'processing' check (status in ('processing','ready','failed','deleted')),
  test_only boolean not null default true, generation_id uuid, cleanup_completed_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index audio_assets_owner_created on public.audio_assets(user_id, created_at desc);
create table public.audio_voice_profiles (
  id uuid primary key, user_id text not null, name text not null,
  provider_voice_id text unique, source_asset_id uuid references public.audio_assets(id) on delete restrict,
  consent_at timestamptz not null, status text not null check (status in ('creating','ready','verification_required','failed','deleted')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create index audio_voice_profiles_owner on public.audio_voice_profiles(user_id, status);
create unique index audio_voice_profiles_one_per_reference on public.audio_voice_profiles(user_id, source_asset_id)
  where status in ('creating','ready','verification_required');
create table public.audio_generation_requests (
  id uuid primary key, user_id text not null, job_id uuid unique references public.background_jobs(id) on delete restrict,
  request_key uuid not null, fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  kind text not null check (kind in ('speech','clone','upload')),
  status text not null default 'queued' check (status in ('queued','processing','streaming','completed','failed','uncertain','cancelled')),
  script text not null default '' check (length(script) <= 1500), voice_id text, model_id text,
  speed numeric not null default 1 check (speed between 0.8 and 1.2), name text not null,
  source_asset_id uuid references public.audio_assets(id) on delete restrict,
  output_asset_id uuid references public.audio_assets(id) on delete restrict,
  voice_profile_id uuid references public.audio_voice_profiles(id) on delete restrict,
  provider_request_id text, provider_started_at timestamptz,
  chunk_count integer not null default 0 check (chunk_count >= 0), byte_count integer not null default 0,
  error_message text, test_only boolean not null default true,
  quota_period text not null, characters integer not null check (characters >= 0),
  cost_micros bigint not null check (cost_micros >= 0), credits integer not null default 0 check (credits >= 0),
  usage_released boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(user_id, request_key)
);
create index audio_requests_owner_created on public.audio_generation_requests(user_id, created_at desc);
create table public.audio_usage_counters (
  scope text not null, period text not null, characters bigint not null default 0,
  cost_micros bigint not null default 0, requests integer not null default 0,
  primary key(scope, period), check (characters >= 0 and cost_micros >= 0 and requests >= 0)
);
create table public.audio_provider_lease (
  id text primary key check (id = 'elevenlabs'), request_id uuid,
  expires_at timestamptz not null default now()
);
insert into public.audio_provider_lease(id) values ('elevenlabs');

alter table public.audio_assets enable row level security;
alter table public.audio_voice_profiles enable row level security;
alter table public.audio_generation_requests enable row level security;
alter table public.audio_usage_counters enable row level security;
alter table public.audio_provider_lease enable row level security;
revoke all on public.audio_assets, public.audio_voice_profiles, public.audio_generation_requests,
  public.audio_usage_counters, public.audio_provider_lease from public, anon, authenticated;
grant all on public.audio_assets, public.audio_voice_profiles, public.audio_generation_requests,
  public.audio_usage_counters, public.audio_provider_lease to service_role;
-- No browser storage.objects policy: reads/writes use authenticated app APIs.

create function public.create_audio_generation_request(
  p_id uuid, p_user_id text, p_request_key uuid, p_fingerprint text, p_kind text,
  p_payload jsonb, p_period text, p_characters integer, p_cost_micros bigint,
  p_global_character_limit integer, p_user_character_limit integer,
  p_cost_limit_micros bigint, p_request_limit integer, p_credits integer
) returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_existing public.audio_generation_requests; v_job jsonb; v_job_id uuid;
  v_asset public.audio_assets; v_profile public.audio_voice_profiles;
begin
  if nullif(btrim(p_user_id), '') is null or p_kind not in ('speech','clone','upload')
    or p_fingerprint !~ '^[0-9a-f]{64}$' or jsonb_typeof(p_payload) <> 'object'
    or p_characters < 0 or p_cost_micros < 0 or p_credits < 0
    or p_global_character_limit < 1 or p_user_character_limit < 1
    or p_cost_limit_micros < 0 or p_request_limit < 1
    or p_period is null or length(p_period) > 100 then raise exception 'audio_input_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('audio-quota:' || p_period, 0));
  select * into v_existing from public.audio_generation_requests where user_id = p_user_id and request_key = p_request_key;
  if found then
    if v_existing.fingerprint <> p_fingerprint then raise exception 'audio_request_conflict'; end if;
    return to_jsonb(v_existing);
  end if;
  -- Retirement takes the same row locks. Check readiness after waiting for
  -- them so a stale browser catalogue cannot queue use of a deleted recording.
  if p_kind in ('clone','upload') then
    select * into v_asset from public.audio_assets
      where id = (p_payload->>'sourceAssetId')::uuid and user_id = p_user_id for update;
    if not found or not ((p_kind = 'upload' and v_asset.status = 'processing') or
      (p_kind = 'clone' and v_asset.status = 'ready' and v_asset.purpose = 'reference'))
    then raise exception 'audio_source_invalid'; end if;
  end if;
  if p_kind = 'speech' then
    if nullif(p_payload->>'privateVoiceProfileId','') is not null then
      select * into v_profile from public.audio_voice_profiles
        where id = (p_payload->>'privateVoiceProfileId')::uuid and user_id = p_user_id for update;
      if not found or v_profile.status <> 'ready' or v_profile.provider_voice_id is distinct from p_payload->>'voiceId'
        then raise exception 'audio_voice_unavailable'; end if;
    else
      select * into v_profile from public.audio_voice_profiles where provider_voice_id = p_payload->>'voiceId' for update;
      if found and (v_profile.user_id <> p_user_id or v_profile.status <> 'ready') then raise exception 'audio_voice_unavailable'; end if;
    end if;
  end if;
  if p_kind = 'clone' then
    perform pg_advisory_xact_lock(hashtextextended('audio-clone:' || p_user_id || ':' || (p_payload->>'sourceAssetId'),0));
    select r.* into v_existing from public.audio_generation_requests r
      where r.user_id = p_user_id and r.kind = 'clone' and r.source_asset_id = (p_payload->>'sourceAssetId')::uuid
        and (r.status in ('queued','processing','streaming','uncertain') or
          (r.status = 'completed' and exists (select 1 from public.audio_voice_profiles v where v.id = r.voice_profile_id and v.status <> 'deleted')))
      order by r.created_at desc limit 1;
    if found then return to_jsonb(v_existing); end if;
  end if;
  insert into public.audio_usage_counters(scope, period) values ('global',p_period),('user:' || p_user_id,p_period) on conflict do nothing;
  if exists (select 1 from public.audio_usage_counters where period = p_period and (
    (scope = 'global' and (characters + p_characters > p_global_character_limit or cost_micros + p_cost_micros > p_cost_limit_micros))
    or (scope = 'user:' || p_user_id and (characters + p_characters > p_user_character_limit or requests + 1 > p_request_limit))
  )) then raise exception 'audio_quota_exceeded'; end if;
  if p_credits > 0 then
    perform public.reserve_billing_credits(p_user_id, 'audio:' || p_request_key::text, 'generate_audio', p_credits);
  end if;
  v_job := public.create_or_get_background_job_v1('audio:' || p_request_key::text,
    jsonb_build_object('audioRequestId',p_id), null, 'generate_audio', 3, 'audio-generation','ai-generation',p_user_id);
  v_job_id := (v_job->'job'->>'id')::uuid;
  if v_job_id is null then raise exception 'audio_job_invalid'; end if;
  if p_credits > 0 then
    update public.billing_credit_reservations set background_job_id = v_job_id
      where user_id = p_user_id and idempotency_key = 'audio:' || p_request_key::text;
  end if;
  insert into public.audio_generation_requests(id,user_id,job_id,request_key,fingerprint,kind,script,voice_id,model_id,speed,name,source_asset_id,voice_profile_id,test_only,quota_period,characters,cost_micros,credits)
  values (p_id,p_user_id,v_job_id,p_request_key,p_fingerprint,p_kind,coalesce(p_payload->>'script',''),p_payload->>'voiceId',p_payload->>'modelId',
    coalesce((p_payload->>'speed')::numeric,1),p_payload->>'name',(p_payload->>'sourceAssetId')::uuid,v_profile.id,coalesce((p_payload->>'testOnly')::boolean,true),p_period,p_characters,p_cost_micros,p_credits)
  returning * into v_existing;
  update public.audio_usage_counters set characters = characters + p_characters, cost_micros = cost_micros + p_cost_micros, requests = requests + 1
    where period = p_period and scope in ('global','user:' || p_user_id);
  return to_jsonb(v_existing);
end;
$function$;

create function public.claim_audio_provider(p_request_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare v_id uuid;
begin
  update public.audio_provider_lease set request_id = p_request_id, expires_at = now() + interval '5 minutes'
    where id = 'elevenlabs' and expires_at <= now() returning request_id into v_id;
  return v_id is not null;
end;
$function$;
create function public.release_audio_provider(p_request_id uuid)
returns void language sql security definer set search_path = '' as $function$
  update public.audio_provider_lease set request_id = null, expires_at = now() where request_id = p_request_id;
$function$;

create function public.start_audio_provider_submission(p_id uuid, p_user_id text)
returns boolean language plpgsql security definer set search_path = '' as $function$
declare v_status text; v_id uuid;
begin
  -- Cancellation and terminal transitions already lock the job first. Use
  -- that same order, then atomically mark the owned request exactly once.
  select j.status into v_status from public.background_jobs j
    join public.audio_generation_requests r on r.job_id = j.id
    where r.id = p_id and r.user_id = p_user_id and j.user_id = p_user_id for update of j;
  if not found or v_status <> 'processing' then return false; end if;
  update public.audio_generation_requests set provider_started_at = now(), status = 'processing', updated_at = now()
    where id = p_id and user_id = p_user_id and provider_started_at is null and not usage_released
      and status in ('queued','processing') returning id into v_id;
  return v_id is not null;
end;
$function$;

-- Retire records before external cleanup. This closes admission races and
-- preserves owner-visible cleanup metadata until an explicit retry succeeds.
create function public.retire_audio_voice(p_id uuid, p_user_id text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_profile public.audio_voice_profiles;
begin
  select * into v_profile from public.audio_voice_profiles where id = p_id and user_id = p_user_id for update;
  if not found then raise exception 'audio_voice_not_found'; end if;
  if v_profile.status = 'creating' or exists (
    select 1 from public.audio_generation_requests r where r.user_id = p_user_id
      and (r.voice_id = v_profile.provider_voice_id or r.voice_profile_id = p_id or (r.kind = 'clone' and r.id = p_id))
      and r.status in ('queued','processing','streaming','uncertain')
  ) then raise exception 'audio_voice_in_use'; end if;
  update public.audio_voice_profiles set status = 'deleted', updated_at = now() where id = p_id returning * into v_profile;
  return to_jsonb(v_profile);
end;
$function$;
create function public.retire_audio_asset(p_id uuid, p_user_id text)
returns jsonb language plpgsql security definer set search_path = '' as $function$
declare v_asset public.audio_assets; v_chunks integer;
begin
  select * into v_asset from public.audio_assets where id = p_id and user_id = p_user_id for update;
  if not found then raise exception 'audio_asset_not_found'; end if;
  if v_asset.status = 'processing' or exists (
    select 1 from public.audio_voice_profiles v where v.user_id = p_user_id and v.source_asset_id = p_id
      and (v.status in ('creating','ready','verification_required') or (v.status = 'deleted' and v.provider_voice_id is not null))
  ) or exists (
    select 1 from public.audio_generation_requests r where r.user_id = p_user_id
      and (r.source_asset_id = p_id or r.output_asset_id = p_id or r.id = p_id)
      and r.status in ('queued','processing','streaming','uncertain')
  ) then raise exception 'audio_asset_in_use'; end if;
  select coalesce(chunk_count,0) into v_chunks from public.audio_generation_requests
    where id = v_asset.generation_id and user_id = p_user_id;
  update public.audio_assets set status = 'deleted', updated_at = now() where id = p_id returning * into v_asset;
  return jsonb_build_object('asset',to_jsonb(v_asset),'chunk_count',coalesce(v_chunks,0));
end;
$function$;

create function public.settle_audio_job_terminal()
returns trigger language plpgsql security definer set search_path = '' as $function$
declare v_request public.audio_generation_requests;
begin
  if new.job_type <> 'generate_audio' or new.status not in ('failed','cancelled') then return new; end if;
  select * into v_request from public.audio_generation_requests where job_id = new.id for update;
  if not found or v_request.status = 'completed' then return new; end if;
  if v_request.provider_started_at is null and not v_request.usage_released then
    perform pg_advisory_xact_lock(hashtextextended('audio-quota:' || v_request.quota_period,0));
    update public.audio_usage_counters set characters = greatest(0,characters-v_request.characters), cost_micros = greatest(0,cost_micros-v_request.cost_micros)
      where period = v_request.quota_period and scope in ('global','user:' || v_request.user_id);
    update public.audio_generation_requests set usage_released = true where id = v_request.id;
  end if;
  update public.audio_generation_requests set status = case when status = 'uncertain' then status else new.status end,
    error_message = coalesce(error_message, 'Audio generation did not complete. Check this result before generating again.'), updated_at = now() where id = v_request.id;
  if v_request.kind = 'upload' then update public.audio_assets set status = 'failed' where id = v_request.source_asset_id and status = 'processing'; end if;
  if v_request.kind = 'clone' and v_request.provider_started_at is null then
    update public.audio_voice_profiles set status = 'failed', updated_at = now() where id = v_request.id and status = 'creating';
  end if;
  return new;
end;
$function$;
create trigger settle_audio_job_terminal after update of status on public.background_jobs
for each row when (old.status is distinct from new.status and new.job_type = 'generate_audio') execute function public.settle_audio_job_terminal();

revoke all on function public.create_audio_generation_request(uuid,text,uuid,text,text,jsonb,text,integer,bigint,integer,integer,bigint,integer,integer) from public,anon,authenticated;
grant execute on function public.create_audio_generation_request(uuid,text,uuid,text,text,jsonb,text,integer,bigint,integer,integer,bigint,integer,integer) to service_role;
revoke all on function public.claim_audio_provider(uuid), public.release_audio_provider(uuid), public.settle_audio_job_terminal() from public,anon,authenticated;
grant execute on function public.claim_audio_provider(uuid), public.release_audio_provider(uuid), public.settle_audio_job_terminal() to service_role;
revoke all on function public.retire_audio_voice(uuid,text), public.retire_audio_asset(uuid,text), public.start_audio_provider_submission(uuid,text) from public,anon,authenticated;
grant execute on function public.retire_audio_voice(uuid,text), public.retire_audio_asset(uuid,text), public.start_audio_provider_submission(uuid,text) to service_role;
notify pgrst, 'reload schema';
