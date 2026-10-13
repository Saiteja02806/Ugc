-- Immutable video + publishing snapshots, accepted before CPU work starts.
-- Firebase ownership is checked in the app; this outbox is service-only.
create table public.explore_video_schedules (
  user_id text not null,
  request_key uuid not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  schedule_id uuid not null unique references public.scheduled_posts(id),
  state text not null default 'pending' check (state in ('pending','scheduled','failed','cancelled')),
  deadline_at timestamptz not null,
  next_attempt_at timestamptz not null default now(),
  lease_token uuid,
  lease_until timestamptz,
  last_error_code text,
  last_error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id,request_key),
  foreign key (user_id,request_key) references public.explore_video_finishes(user_id,request_key)
);
create index explore_video_schedules_due on public.explore_video_schedules(next_attempt_at) where state='pending';
alter table public.explore_video_schedules enable row level security;
revoke all on public.explore_video_schedules from public,anon,authenticated;
grant select,insert,update on public.explore_video_schedules to service_role;

create function public.explore_reserve_video_schedule(
  p_user_id text,p_request_key uuid,p_request_hash text,p_fingerprint text,p_draft jsonb,p_schedule jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  saved public.explore_video_schedules%rowtype;
  receipt jsonb;
  post_id uuid := gen_random_uuid();
  metadata jsonb;
  deadline timestamptz;
  target jsonb;
begin
  if p_user_id is null or length(p_user_id) not between 1 and 128 or p_request_key is null or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$'
    or p_fingerprint is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_schedule is null or jsonb_typeof(p_schedule)<>'object' then raise exception 'explore_schedule_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('explore-schedule:'||p_user_id||':'||p_request_key::text,0));
  select * into saved from public.explore_video_schedules where user_id=p_user_id and request_key=p_request_key for update;
  if found then
    if saved.request_hash<>p_request_hash then raise exception 'explore_schedule_conflict'; end if;
    return to_jsonb(saved);
  end if;
  metadata := p_schedule->'metadata';
  deadline := (p_schedule->>'scheduledFor')::timestamptz;
  if jsonb_typeof(metadata)<>'object' or deadline is null or deadline<=now() or
    length(coalesce(metadata->>'plannedTargetsJson',''))=0 or length(coalesce(p_schedule->>'timezone',''))=0 or
    coalesce(p_draft->>'captionPreview','false')<>'false' then raise exception 'explore_schedule_invalid'; end if;
  if jsonb_typeof((metadata->>'plannedTargetsJson')::jsonb)<>'array' or
    jsonb_array_length((metadata->>'plannedTargetsJson')::jsonb) not between 1 and 5 then raise exception 'explore_schedule_invalid'; end if;
  for target in select * from jsonb_array_elements((metadata->>'plannedTargetsJson')::jsonb) loop
    if not exists(select 1 from public.social_connections where id=(target->>'connectionId')::uuid
      and user_id=p_user_id and platform=target->>'platform' and status='connected' and revoked_at is null) then
      raise exception 'explore_schedule_account_unavailable';
    end if;
  end loop;
  -- The whole-composition clip-only audio is nested; the legacy reservation
  -- already checks every top-level source/demo/background asset.
  if p_draft->'composition'->>'sourceAudioAssetId' is not null and not exists (
    select 1 from public.media_assets where id=(p_draft->'composition'->>'sourceAudioAssetId')::uuid
    and user_id=p_user_id and collection='audio' and status='ready' and deleted_at is null
  ) then raise exception 'explore_finish_asset_unavailable'; end if;
  receipt := public.explore_create_video_finish(p_user_id,p_request_key,p_fingerprint,p_draft);
  metadata := metadata || jsonb_build_object(
    'mediaMode','single_video','exploreFinishRequestKey',p_request_key,'exploreFinishFingerprint',p_fingerprint,
    'exploreFinishOutputAssetId',receipt->>'output_asset_id','exploreFinishStatus','preparing',
    'finalScheduleStatus','preparing','combinedRenderStatus','queued','combinedRenderQueuedAt',now(),
    'plannedPublishDeadlineAt',deadline
  );
  insert into public.scheduled_posts(id,user_id,caption,title,timezone,scheduled_for,source_kind,status,media_asset_id,
    library_item_id,project_id,idempotency_key,metadata)
  values(post_id,p_user_id,coalesce(p_schedule->>'caption',''),coalesce(p_schedule->>'title','Explore video'),
    p_schedule->>'timezone',deadline,'media_asset','draft',(p_draft->>'sourceAssetId')::uuid,null,
    null,'explore-pending:'||p_request_key::text,metadata);
  insert into public.explore_video_schedules(user_id,request_key,request_hash,schedule_id,deadline_at)
    values(p_user_id,p_request_key,p_request_hash,post_id,deadline) returning * into saved;
  return to_jsonb(saved);
end;
$$;

-- A short lease serializes worker callbacks with periodic crash recovery.
create function public.explore_claim_video_schedule(p_user_id text,p_request_key uuid,p_lease_token uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.explore_video_schedules%rowtype;
begin
  update public.explore_video_schedules set lease_token=p_lease_token,lease_until=now()+interval '2 minutes',updated_at=now()
    where p_lease_token is not null and user_id=p_user_id and request_key=p_request_key and state='pending' and (lease_until is null or lease_until<now())
    returning * into saved;
  return case when found then to_jsonb(saved) else null end;
end;
$$;

-- Failure is also a transactional handoff: cancellation can happen while a
-- worker is checking its output. Preserve terminal publishing/cancellation.
create function public.explore_fail_video_schedule(
  p_user_id text,p_request_key uuid,p_lease_token uuid,p_error_code text,p_message text
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  saved public.explore_video_schedules%rowtype;
  post public.scheduled_posts%rowtype;
  result_state text := 'failed';
begin
  select * into saved from public.explore_video_schedules where user_id=p_user_id and request_key=p_request_key
    and lease_token=p_lease_token and state='pending' for update;
  if not found then raise exception 'explore_schedule_lease_lost'; end if;
  select * into post from public.scheduled_posts where id=saved.schedule_id and user_id=p_user_id for update;
  if not found then raise exception 'explore_schedule_post_missing'; end if;
  if post.status='cancelled' then result_state := 'cancelled';
  elsif post.status in ('published','publishing','scheduled') then result_state := 'scheduled';
  elsif not exists(select 1 from public.scheduled_post_targets where scheduled_post_id=post.id) then
    update public.scheduled_posts set status='failed',updated_at=now(),
      metadata=metadata||jsonb_build_object('exploreFinishStatus','failed','combinedRenderStatus','failed',
        'finalScheduleStatus','failed','finalScheduleError',left(p_message,2000),'finalScheduleErrorCode',left(p_error_code,100))
      where id=post.id;
  end if;
  update public.explore_video_schedules set state=result_state,lease_token=null,lease_until=null,updated_at=now(),
    last_error_code=case when result_state='failed' then left(p_error_code,100) else null end,
    last_error_message=case when result_state='failed' then left(p_message,2000) else null end
    where user_id=p_user_id and request_key=p_request_key returning * into saved;
  return to_jsonb(saved);
end;
$$;

revoke all on function public.explore_reserve_video_schedule(text,uuid,text,text,jsonb,jsonb),
  public.explore_claim_video_schedule(text,uuid,uuid),public.explore_fail_video_schedule(text,uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.explore_reserve_video_schedule(text,uuid,text,text,jsonb,jsonb),
  public.explore_claim_video_schedule(text,uuid,uuid),public.explore_fail_video_schedule(text,uuid,uuid,text,text) to service_role;
