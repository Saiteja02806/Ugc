-- Freeze the saved Edit revision, render snapshot and recoverable job together.
create table public.edit_export_requests (
  user_id text not null, request_id uuid not null,
  draft_id uuid not null references public.editable_videos(id),
  expected_revision bigint not null check (expected_revision between 0 and 9007199254740991),
  render_id uuid not null unique references public.video_render_jobs(render_id),
  job_id uuid not null unique references public.background_jobs(id),
  output_asset_id uuid not null unique, render_payload jsonb not null,
  title text not null, duration_seconds numeric,
  created_at timestamptz not null default clock_timestamp(), primary key(user_id,request_id)
);
alter table public.edit_export_requests enable row level security;
revoke all on table public.edit_export_requests from public,anon,authenticated;
grant select,insert on table public.edit_export_requests to service_role;

create function public.edit_start_export(p_user_id text,p_request_id uuid,p_draft_id uuid,p_expected_revision bigint,
  p_stored_draft jsonb,p_render_draft jsonb,p_source_url text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_video public.editable_videos%rowtype; v_asset public.media_assets%rowtype;
  v_receipt public.edit_export_requests%rowtype; v_render uuid := gen_random_uuid(); v_job uuid := gen_random_uuid();
  v_output uuid := gen_random_uuid(); v_payload jsonb; v_start numeric; v_end numeric;
begin
  if nullif(btrim(p_user_id),'') is null or p_request_id is null or p_draft_id is null or p_expected_revision is null
    or p_expected_revision not between 0 and 9007199254740991 then raise exception 'edit_export_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('edit-export:'||p_user_id||':'||p_request_id::text,0));
  select * into v_receipt from public.edit_export_requests where user_id=p_user_id and request_id=p_request_id;
  if found then
    if v_receipt.draft_id<>p_draft_id or v_receipt.expected_revision<>p_expected_revision then raise exception 'edit_export_request_conflict'; end if;
    return jsonb_build_object('receipt',to_jsonb(v_receipt),'replayed',true);
  end if;
  select * into v_video from public.editable_videos where id=p_draft_id and user_id=p_user_id and deleted_at is null for update;
  if not found then raise exception 'edit_export_not_found'; end if;
  if v_video.draft_revision<>p_expected_revision or v_video.draft_json is distinct from p_stored_draft then raise exception 'edit_export_changed'; end if;
  select * into v_asset from public.media_assets where id::text=v_video.source_video_id and user_id=p_user_id
    and collection in ('video','influencer') and source_type in ('upload','influencer_upload','demo_upload','catalog_influencer','generated_video')
    and status='ready' and deleted_at is null for share;
  if not found then raise exception 'edit_export_not_found'; end if;
  if v_asset.url is distinct from p_source_url or v_video.source_video_url is distinct from p_source_url then raise exception 'edit_export_source_changed'; end if;
  if p_render_draft is null or jsonb_typeof(p_render_draft)<>'object' or octet_length(p_render_draft::text)>8192
    or jsonb_typeof(p_render_draft->'trimStartSeconds') is distinct from 'number'
    or not(p_render_draft ? 'trimEndSeconds') or jsonb_typeof(p_render_draft->'trimEndSeconds') not in ('number','null')
    or jsonb_typeof(p_render_draft->'textOverlays') is distinct from 'array' then raise exception 'edit_export_invalid'; end if;
  v_start := (p_render_draft->>'trimStartSeconds')::numeric; v_end := (p_render_draft->>'trimEndSeconds')::numeric;
  if v_start<0 or (v_end is not null and v_end<=v_start) or jsonb_array_length(p_render_draft->'textOverlays')>3
    or (v_asset.duration_seconds>0 and (v_start>=v_asset.duration_seconds or v_end>v_asset.duration_seconds+.05)) then raise exception 'edit_export_invalid'; end if;
  v_payload := jsonb_build_object('renderId',v_render,'userId',p_user_id,'projectId',v_video.project_id,
    'sourceVideoId',v_video.source_video_id,'sourceVideoUrl',p_source_url,'ratio',v_video.ratio,'draft',p_render_draft);
  insert into public.video_render_jobs(render_id,user_id,project_id,source_video_id,source_video_url,ratio,draft_json,status)
    values(v_render,p_user_id,v_video.project_id,v_video.source_video_id,p_source_url,v_video.ratio,p_render_draft,'queued');
  insert into public.background_jobs(id,user_id,project_id,job_type,queue_name,status,input_json,idempotency_key,queue_provider,queued_at,next_attempt_at)
    values(v_job,p_user_id,v_video.project_id,'render_edit_video','video-render','queued',v_payload,
      'edit-export:'||p_request_id::text,'gcp',clock_timestamp(),clock_timestamp());
  insert into public.edit_export_requests(user_id,request_id,draft_id,expected_revision,render_id,job_id,output_asset_id,render_payload,title,duration_seconds)
    values(p_user_id,p_request_id,p_draft_id,p_expected_revision,v_render,v_job,v_output,v_payload,v_video.title,
      case when coalesce(v_end,v_asset.duration_seconds)>v_start then coalesce(v_end,v_asset.duration_seconds)-v_start else null end)
    returning * into v_receipt;
  update public.editable_videos set latest_render_id=v_render,status='rendering',updated_at=clock_timestamp() where id=p_draft_id;
  -- Preserve the Demo page's status integration without replacing either working draft.
  update public.demo_videos set latest_render_id=v_render,status='rendering',error_message=null,updated_at=clock_timestamp()
    where id::text=v_video.source_video_id and user_id=p_user_id and project_id=v_video.project_id and deleted_at is null;
  return jsonb_build_object('receipt',to_jsonb(v_receipt),'replayed',false);
end; $$;
revoke all on function public.edit_start_export(text,uuid,uuid,bigint,jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.edit_start_export(text,uuid,uuid,bigint,jsonb,jsonb,text) to service_role;

-- The existing worker/finalizer commits a ready immutable MCP artifact with its
-- completed render. Website-only runs are unaffected; no worker deploy is needed.
create function public.edit_export_register_output() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_receipt public.edit_export_requests%rowtype; v_width integer; v_height integer;
begin
  if new.status <> 'completed' then return new; end if;
  select * into v_receipt from public.edit_export_requests where render_id=new.render_id and user_id=new.user_id;
  if not found then return new; end if;
  if new.project_id is distinct from v_receipt.render_payload->>'projectId'
    or new.source_video_id is distinct from v_receipt.render_payload->>'sourceVideoId'
    or new.source_video_url is distinct from v_receipt.render_payload->>'sourceVideoUrl'
    or new.ratio is distinct from v_receipt.render_payload->>'ratio'
    or new.draft_json is distinct from v_receipt.render_payload->'draft'
    or nullif(btrim(new.output_s3_key),'') is null or new.output_url !~ '^https?://' then raise exception 'edit_export_output_invalid'; end if;
  -- Removal wins: never reinsert deleted media or create an artifact for a
  -- removed project/source. The historical receipt remains readable.
  perform 1 from public.editable_videos where id=v_receipt.draft_id and user_id=new.user_id and deleted_at is null for share;
  if not found then return new; end if;
  perform 1 from public.media_assets where id::text=new.source_video_id and user_id=new.user_id and deleted_at is null for share;
  if not found then return new; end if;
  v_width := case new.ratio when '16:9' then 1920 else 1080 end;
  v_height := case new.ratio when '9:16' then 1920 when '4:5' then 1350 else 1080 end;
  insert into public.media_assets(id,user_id,project_id,collection,source_type,source_record_id,parent_asset_id,title,
    storage_key,url,mime_type,duration_seconds,width,height,ratio,status,metadata)
    values(v_receipt.output_asset_id,new.user_id,new.project_id,'video','edit_export',new.render_id::text,new.source_video_id::uuid,
      left(v_receipt.title||' · Edit export',140),new.output_s3_key,new.output_url,'video/mp4',v_receipt.duration_seconds,
      v_width,v_height,new.ratio,'ready',jsonb_build_object('editDraftId',v_receipt.draft_id,'editDraftRevision',v_receipt.expected_revision,'editRenderId',new.render_id))
    on conflict(id) do nothing;
  return new;
end; $$;
revoke all on function public.edit_export_register_output() from public,anon,authenticated;
grant execute on function public.edit_export_register_output() to service_role;
create trigger edit_export_register_output after update of status on public.video_render_jobs
  for each row execute function public.edit_export_register_output();
