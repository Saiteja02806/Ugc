-- Opening a source creates at most one active editor and never replaces existing edits.
create function public.edit_open_draft(p_user_id text,p_asset_id uuid,p_initial_draft jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_source public.media_assets%rowtype; v_video public.editable_videos%rowtype;
  v_project text; v_ratio text; v_classification text;
begin
  if nullif(btrim(p_user_id),'') is null or p_asset_id is null
    or (p_initial_draft is not null and (jsonb_typeof(p_initial_draft)<>'object' or octet_length(p_initial_draft::text)>8192))
    then raise exception 'edit_open_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('edit-open:'||p_user_id||':'||p_asset_id::text,0));
  select * into v_source from public.media_assets where id=p_asset_id and user_id=p_user_id and deleted_at is null for share;
  if not found then raise exception 'edit_open_not_found'; end if;
  if v_source.collection not in ('video','influencer') or v_source.source_type not in
    ('upload','influencer_upload','demo_upload','catalog_influencer','generated_video') then raise exception 'edit_open_unsupported'; end if;
  if v_source.status <> 'ready' then raise exception 'edit_open_not_ready'; end if;
  -- Preserve the website's newest legacy project selection; ties are deterministic.
  select * into v_video from public.editable_videos where user_id=p_user_id and source_video_id=p_asset_id::text and deleted_at is null
    order by updated_at desc,id desc limit 1 for update;
  if found then return jsonb_build_object('video',to_jsonb(v_video),'reused',true); end if;
  v_project := coalesce(v_source.project_id,'test-project-001');
  select * into v_video from public.editable_videos where user_id=p_user_id and project_id=v_project and source_video_id=p_asset_id::text for update;
  if found then raise exception 'edit_open_removed'; end if;
  v_ratio := v_source.ratio;
  if v_ratio not in ('9:16','1:1','4:5','16:9') then
    v_ratio := '9:16';
    if v_source.width > 0 and v_source.height > 0 then
      select r.ratio into v_ratio from (values ('9:16',9::numeric/16),('1:1',1::numeric),('4:5',4::numeric/5),('16:9',16::numeric/9)) r(ratio,aspect)
        order by abs(ln((v_source.width::numeric/v_source.height)/r.aspect)),r.ratio limit 1;
    end if;
  end if;
  v_classification := case when v_source.source_type='demo_upload' then 'demo'
    when v_source.collection='influencer' or v_source.source_type in ('influencer_upload','catalog_influencer','generated_video') then 'hook' else 'draft' end;
  insert into public.editable_videos(user_id,project_id,source_video_id,source,title,ratio,source_video_url,thumbnail_url,duration_seconds,draft_json,status)
    values(p_user_id,v_project,p_asset_id::text,v_classification,v_source.title,v_ratio,v_source.url,v_source.thumbnail_url,v_source.duration_seconds,
      p_initial_draft,case when p_initial_draft is null then 'ready' else 'draft' end)
    on conflict(user_id,project_id,source_video_id) do nothing returning * into v_video;
  if found then return jsonb_build_object('video',to_jsonb(v_video),'reused',false); end if;
  select * into v_video from public.editable_videos where user_id=p_user_id and project_id=v_project and source_video_id=p_asset_id::text and deleted_at is null for update;
  if not found then raise exception 'edit_open_removed'; end if;
  return jsonb_build_object('video',to_jsonb(v_video),'reused',true);
end; $$;
revoke all on function public.edit_open_draft(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.edit_open_draft(text,uuid,jsonb) to service_role;
