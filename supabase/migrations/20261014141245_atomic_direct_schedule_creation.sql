-- A direct scheduling acknowledgement owns the complete post, destination
-- snapshot, targets and queued publishing jobs. No split-write fallback.
-- Existing target billing/trial triggers participate in this transaction.
create function public.create_direct_scheduled_post(
  p_post jsonb, p_targets jsonb, p_request_hash text, p_queue_name text
) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  saved public.scheduled_posts%rowtype;
  target_row public.scheduled_post_targets%rowtype;
  target jsonb;
  job jsonb;
  owner text := p_post->>'user_id';
  request_key text := nullif(btrim(p_post->>'idempotency_key'), '');
begin
  if jsonb_typeof(p_post) is distinct from 'object' or
    jsonb_typeof(p_targets) is distinct from 'array' or
    jsonb_array_length(p_targets) not between 1 and 5 or
    owner is null or length(owner) not between 1 and 128 or
    p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' or
    nullif(btrim(p_queue_name), '') is null or
    p_post->>'status' is distinct from 'scheduling' or
    (p_post->>'source_kind') is null or p_post->>'source_kind' not in ('media_asset','library_item') or
    p_post->>'scheduled_for' is null or
    jsonb_typeof(p_post->'metadata') is distinct from 'object' then
    raise exception 'schedule_create_invalid';
  end if;
  if request_key is not null then
    perform pg_advisory_xact_lock(hashtextextended('direct-schedule:' || owner || ':' || request_key, 0));
    select * into saved from public.scheduled_posts
      where user_id=owner and idempotency_key=request_key for update;
    if found then
      if saved.metadata->>'scheduleCreateRequestHash' is distinct from p_request_hash then
        raise exception 'schedule_idempotency_conflict';
      end if;
      return jsonb_build_object('created',false,'post',to_jsonb(saved),
        'targets',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb)
          from public.scheduled_post_targets t where t.scheduled_post_id=saved.id and t.user_id=owner));
    end if;
  end if;
  -- Replays above retain their accepted time. A new confirmation whose time
  -- elapsed during account/source preflight cannot start immediate publishing.
  if (p_post->>'scheduled_for')::timestamptz <= clock_timestamp() then
    raise exception 'schedule_time_too_soon';
  end if;
  -- Check owned sources/accounts again under row locks; app preflight is not
  -- permission to bind another owner or a source deleted during confirmation.
  if p_post->>'source_kind'='media_asset' then
    perform 1 from public.media_assets where id=(p_post->>'media_asset_id')::uuid
      and user_id=owner and status='ready' and deleted_at is null for share;
  else
    perform 1 from public.library_items where id=(p_post->>'library_item_id')::uuid
      and user_id=owner and status='ready' and deleted_at is null for share;
  end if;
  if not found then raise exception 'schedule_source_unavailable'; end if;
  insert into public.scheduled_posts(user_id,project_id,source_kind,media_asset_id,library_item_id,
    title,caption,timezone,scheduled_for,status,idempotency_key,metadata)
  values(owner,p_post->>'project_id',p_post->>'source_kind',(p_post->>'media_asset_id')::uuid,
    (p_post->>'library_item_id')::uuid,p_post->>'title',p_post->>'caption',p_post->>'timezone',
    (p_post->>'scheduled_for')::timestamptz,'scheduling',request_key,
    (p_post->'metadata') || jsonb_build_object('scheduleCreateRequestHash',p_request_hash)) returning * into saved;
  for target in select * from jsonb_array_elements(p_targets) loop
    if jsonb_typeof(target) is distinct from 'object' or
      jsonb_typeof(target->'settings') is distinct from 'object' or
      target->>'platform' is null or target->>'platform' not in ('instagram','tiktok','youtube') then
      raise exception 'schedule_target_invalid';
    end if;
    perform 1 from public.social_connections where id=(target->>'social_connection_id')::uuid
      and user_id=owner and platform=target->>'platform' and status='connected'
      and revoked_at is null for share;
    if not found then raise exception 'schedule_account_unavailable'; end if;
    insert into public.scheduled_post_targets(scheduled_post_id,user_id,social_connection_id,platform,
      scheduled_for,status,settings,metadata)
    values(saved.id,owner,(target->>'social_connection_id')::uuid,target->>'platform',saved.scheduled_for,
      'scheduling',target->'settings','{}'::jsonb) returning * into target_row;
    job := public.create_or_get_background_job_v1('social-publish:' || target_row.id,
      jsonb_build_object('targetId',target_row.id),null,'publish_social_post',3,saved.project_id,p_queue_name,owner);
    if job->'job'->>'user_id' is distinct from owner or
      job->'job'->>'job_type' is distinct from 'publish_social_post' or
      job->'job'->'input_json'->>'targetId' is distinct from target_row.id::text or
      job->'job'->>'status' is distinct from 'queued' then raise exception 'schedule_publish_job_invalid'; end if;
    update public.scheduled_post_targets set publish_job_id=(job->'job'->>'id')::uuid where id=target_row.id;
  end loop;
  return jsonb_build_object('created',true,'post',to_jsonb(saved),
    'targets',(select jsonb_agg(to_jsonb(t) order by t.id) from public.scheduled_post_targets t where t.scheduled_post_id=saved.id));
end;
$$;
revoke all on function public.create_direct_scheduled_post(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.create_direct_scheduled_post(jsonb,jsonb,text,text) to service_role;
select pg_notify('pgrst','reload schema');
