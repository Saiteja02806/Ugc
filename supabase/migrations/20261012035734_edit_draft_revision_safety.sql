-- Shared website/MCP Edit drafts; render jobs retain immutable snapshots.
alter table public.editable_videos add column draft_revision bigint not null default 0
  check (draft_revision between 0 and 9007199254740991);

create function public.edit_bump_draft_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.draft_revision := old.draft_revision + case when new.draft_json is distinct from old.draft_json then 1 else 0 end;
  return new;
end; $$;
create trigger edit_bump_draft_revision before update on public.editable_videos
for each row execute function public.edit_bump_draft_revision();
revoke all on function public.edit_bump_draft_revision() from public, anon, authenticated;
grant execute on function public.edit_bump_draft_revision() to service_role;

create table public.edit_draft_save_requests (
  user_id text not null, request_id uuid not null, draft_id uuid not null references public.editable_videos(id) on delete cascade,
  expected_revision bigint not null, draft_json jsonb not null, accepted_video jsonb not null,
  created_at timestamptz not null default clock_timestamp(), primary key (user_id, request_id)
);
alter table public.edit_draft_save_requests enable row level security;
revoke all on table public.edit_draft_save_requests from public, anon, authenticated;
grant select, insert on table public.edit_draft_save_requests to service_role;
create index editable_videos_owner_draft_page_idx on public.editable_videos (user_id, created_at desc, id desc) where deleted_at is null;

create function public.edit_save_draft(p_user_id text, p_draft_id uuid, p_request_id uuid, p_expected_revision bigint, p_draft jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_video public.editable_videos%rowtype; v_receipt public.edit_draft_save_requests%rowtype;
  v_start numeric; v_end numeric;
begin
  if nullif(btrim(p_user_id),'') is null or p_draft_id is null or p_request_id is null or p_expected_revision is null
    or p_expected_revision < 0 or p_draft is null or jsonb_typeof(p_draft) <> 'object' or octet_length(p_draft::text) > 8192
    or jsonb_typeof(p_draft->'trimStartSeconds') is distinct from 'number'
    or jsonb_typeof(p_draft->'trimEndSeconds') not in ('number','null') or not (p_draft ? 'trimEndSeconds')
    or jsonb_typeof(p_draft->'textOverlays') is distinct from 'array' then raise exception 'edit_draft_invalid'; end if;
  v_start := (p_draft->>'trimStartSeconds')::numeric; v_end := (p_draft->>'trimEndSeconds')::numeric;
  if v_start < 0 or (v_end is not null and v_end <= v_start) or jsonb_array_length(p_draft->'textOverlays') > 3 then raise exception 'edit_draft_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('edit-draft:' || p_user_id || ':' || p_request_id::text,0));
  select * into v_video from public.editable_videos where id=p_draft_id and user_id=p_user_id and deleted_at is null for update;
  if not found then raise exception 'edit_draft_not_found'; end if;
  select * into v_receipt from public.edit_draft_save_requests where user_id=p_user_id and request_id=p_request_id;
  if found then
    if v_receipt.draft_id <> p_draft_id or v_receipt.expected_revision <> p_expected_revision or v_receipt.draft_json <> p_draft then raise exception 'edit_draft_request_conflict'; end if;
    return jsonb_build_object('video',v_receipt.accepted_video,'replayed',true);
  end if;
  if v_video.draft_revision <> p_expected_revision then raise exception 'edit_draft_changed'; end if;
  if not exists (select 1 from public.media_assets a where a.id::text=v_video.source_video_id and a.user_id=p_user_id
    and a.collection in ('video','influencer') and a.source_type in ('upload','influencer_upload','demo_upload','catalog_influencer','generated_video') and a.status='ready' and a.deleted_at is null) then raise exception 'edit_draft_not_found'; end if;
  if v_video.duration_seconds > 0 and (v_start >= v_video.duration_seconds or v_end > v_video.duration_seconds + .05) then raise exception 'edit_draft_invalid'; end if;
  update public.editable_videos set draft_json=p_draft, status=case when status='rendering' then 'rendering' else 'draft' end,
    updated_at=clock_timestamp() where id=p_draft_id returning * into v_video;
  insert into public.edit_draft_save_requests(user_id,request_id,draft_id,expected_revision,draft_json,accepted_video)
    values(p_user_id,p_request_id,p_draft_id,p_expected_revision,p_draft,to_jsonb(v_video));
  return jsonb_build_object('video',to_jsonb(v_video),'replayed',false);
end; $$;
revoke all on function public.edit_save_draft(text,uuid,uuid,bigint,jsonb) from public,anon,authenticated;
grant execute on function public.edit_save_draft(text,uuid,uuid,bigint,jsonb) to service_role;

-- Queue status and snapshot insertion commit together; never replace the working draft.
create function public.edit_queue_render_snapshot(p_user_id text,p_draft_id uuid,p_render_id uuid,p_draft jsonb)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare v_video public.editable_videos%rowtype;
begin
  select * into v_video from public.editable_videos where id=p_draft_id and user_id=p_user_id and deleted_at is null for update;
  if not found or v_video.source_video_url is null then raise exception 'edit_draft_not_found'; end if;
  if p_draft is null or jsonb_typeof(p_draft) <> 'object' then raise exception 'edit_draft_invalid'; end if;
  insert into public.video_render_jobs(render_id,user_id,project_id,source_video_id,source_video_url,ratio,draft_json,status)
    values(p_render_id,p_user_id,v_video.project_id,v_video.source_video_id,v_video.source_video_url,v_video.ratio,p_draft,'queued');
  update public.editable_videos set latest_render_id=p_render_id,status='rendering',updated_at=clock_timestamp() where id=p_draft_id;
  return true;
end; $$;
revoke all on function public.edit_queue_render_snapshot(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.edit_queue_render_snapshot(text,uuid,uuid,jsonb) to service_role;
