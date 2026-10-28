-- Leased preparation, with a row-locked fence at the existing atomic schedule
-- transaction. Only service_role may claim or commit automation work.
alter table public.trending_slideshow_automations
  add column execution_token uuid,
  add column execution_expires_at timestamptz;
alter table public.trending_slideshow_automation_slots add column cancel_requested_at timestamptz;
create unique index trending_automation_source_once on public.trending_slideshow_automation_slots(user_id,creative_id) where creative_id is not null;

create function public.claim_slideshow_automation(p_user_id text,p_token uuid,p_revision integer)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.trending_slideshow_automations
    set execution_token=p_token,execution_expires_at=clock_timestamp()+interval '5 minutes'
    where user_id=p_user_id and status='active' and revision=p_revision and p_token is not null
      and (execution_token=p_token or execution_token is null or execution_expires_at<=clock_timestamp());
  return found;
end $$;
create function public.release_slideshow_automation(p_user_id text,p_token uuid)
returns void language sql security invoker set search_path='' as $$
  update public.trending_slideshow_automations set execution_token=null,execution_expires_at=null
  where user_id=p_user_id and execution_token=p_token;
$$;
create function public.checkpoint_slideshow_automation_slot(p_user_id text,p_token uuid,p_revision integer,p_row jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare automation public.trending_slideshow_automations%rowtype; saved public.trending_slideshow_automation_slots%rowtype; candidate public.trending_slideshow_automation_slots%rowtype;
begin
  select * into automation from public.trending_slideshow_automations where user_id=p_user_id for update;
  if not found or automation.status<>'active' or automation.revision<>p_revision
    or automation.execution_token is distinct from p_token or p_token is null
    or automation.execution_expires_at is null or automation.execution_expires_at<=clock_timestamp() then raise exception 'automation_execution_stale'; end if;
  select * into saved from public.trending_slideshow_automation_slots where user_id=p_user_id and idempotency_key=p_row->>'idempotency_key' for update;
  if found and (saved.cancel_requested_at is not null or saved.user_modified or saved.schedule_id is not null) then
    return to_jsonb(saved);
  end if;
  candidate:=jsonb_populate_record(saved,p_row);
  if candidate.user_id is distinct from p_user_id or candidate.snapshot->>'configRevision' is distinct from p_revision::text then raise exception 'automation_slot_stale'; end if;
  if saved.id is null then
    candidate.id:=coalesce(candidate.id,gen_random_uuid());
    insert into public.trending_slideshow_automation_slots select candidate.* returning * into saved;
  else
    update public.trending_slideshow_automation_slots set creative_id=candidate.creative_id,library_item_id=candidate.library_item_id,
      status=candidate.status,hold_message=candidate.hold_message,snapshot=candidate.snapshot,updated_at=clock_timestamp()
      where id=saved.id returning * into saved;
  end if;
  update public.trending_slideshow_automations set execution_expires_at=clock_timestamp()+interval '5 minutes' where user_id=p_user_id;
  return to_jsonb(saved);
end $$;
create function public.finish_slideshow_automation(p_user_id text,p_token uuid,p_revision integer,p_rotation integer,p_reason text,p_message text)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  update public.trending_slideshow_automations set rotation_cursor=p_rotation,
    attention_reason=p_reason,attention_message=p_message,status=case when p_reason is null then status else 'needs_attention' end,
    updated_at=clock_timestamp()
  where user_id=p_user_id and status='active' and revision=p_revision and execution_token=p_token
    and execution_expires_at>clock_timestamp();
  return found;
end $$;
create function public.fence_slideshow_automation_slot(p_user_id text,p_slot_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare saved public.trending_slideshow_automation_slots%rowtype;
begin
  update public.trending_slideshow_automation_slots set cancel_requested_at=clock_timestamp()
  where user_id=p_user_id and id=p_slot_id returning * into saved;
  if not found then raise exception 'automation_slot_unavailable'; end if;
  return to_jsonb(saved);
end $$;

alter function public.create_direct_scheduled_post(jsonb,jsonb,text,text)
  rename to create_direct_scheduled_post_without_automation_fence;
create function public.create_direct_scheduled_post(p_post jsonb,p_targets jsonb,p_request_hash text,p_queue_name text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  guard jsonb:=p_post->'metadata'->'automationExecution';
  automation public.trending_slideshow_automations%rowtype;
  slot public.trending_slideshow_automation_slots%rowtype;
  result jsonb;
begin
  if guard is null and p_post->>'idempotency_key' like 'auto-slot:%' then
    raise exception 'automation_execution_stale';
  end if;
  if guard is not null then
    if jsonb_typeof(guard)<>'object' or guard->>'token' is null or guard->>'slotId' is null or guard->>'revision' is null then
      raise exception 'automation_execution_stale';
    end if;
    select * into automation from public.trending_slideshow_automations
      where user_id=p_post->>'user_id' for update;
    if not found or automation.status<>'active' or automation.revision is distinct from (guard->>'revision')::integer
      or automation.execution_token is distinct from (guard->>'token')::uuid
      or automation.execution_token is null or automation.execution_expires_at is null or automation.execution_expires_at<=clock_timestamp() then
      raise exception 'automation_execution_stale';
    end if;
    select * into slot from public.trending_slideshow_automation_slots
      where user_id=automation.user_id and id=(guard->>'slotId')::uuid for update;
    if not found or slot.cancel_requested_at is not null or slot.user_modified
      or slot.library_item_id is distinct from p_post->>'library_item_id'
      or slot.creative_id is distinct from p_post->'metadata'->>'carouselId'
      or slot.scheduled_for is distinct from (p_post->>'scheduled_for')::timestamptz
      or slot.snapshot->>'configRevision' is distinct from automation.revision::text
      or p_post->>'idempotency_key' is distinct from 'auto-slot:'||encode(sha256(convert_to(slot.idempotency_key,'UTF8')),'hex')
      or slot.status not in ('preparing','scheduled') then
      raise exception 'automation_slot_stale';
    end if;
  end if;
  p_post:=jsonb_set(p_post,'{metadata}',(p_post->'metadata')-'automationExecution');
  result:=public.create_direct_scheduled_post_without_automation_fence(p_post,p_targets,p_request_hash,p_queue_name);
  if guard is not null then
    update public.trending_slideshow_automation_slots set schedule_id=result->'post'->>'id',status='scheduled',hold_message=null,updated_at=clock_timestamp()
      where id=slot.id and user_id=automation.user_id;
  end if;
  return result;
end $$;
revoke all on function public.claim_slideshow_automation(text,uuid,integer),public.release_slideshow_automation(text,uuid),public.fence_slideshow_automation_slot(text,uuid),public.create_direct_scheduled_post(jsonb,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.claim_slideshow_automation(text,uuid,integer),public.release_slideshow_automation(text,uuid),public.fence_slideshow_automation_slot(text,uuid),public.create_direct_scheduled_post(jsonb,jsonb,text,text) to service_role;
revoke all on function public.checkpoint_slideshow_automation_slot(text,uuid,integer,jsonb),public.finish_slideshow_automation(text,uuid,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.checkpoint_slideshow_automation_slot(text,uuid,integer,jsonb),public.finish_slideshow_automation(text,uuid,integer,integer,text,text) to service_role;
select pg_notify('pgrst','reload schema');
