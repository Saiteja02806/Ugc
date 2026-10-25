-- A generated video's editable text is committed with its completion receipt.
-- Existing edits (including an intentionally empty draft) always win.
create function public.explore_initialize_automatic_hook_text()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare auto_text jsonb; asset_id uuid; asset_duration numeric; editing jsonb;
begin
  if new.status <> 'completed' or new.job_type <> 'generate_hook_video'
    or new.input_json->>'exploreFormat' is distinct from 'hook'
    or new.input_json->'automaticHookText'->>'version' is distinct from '1'
    or new.input_json->'automaticHookText'->'source'->>'referenceId' is distinct from new.input_json->>'referenceId' then return new; end if;
  auto_text := new.output_json->'automaticHookText';
  if auto_text->>'version' is distinct from '1' or auto_text->>'requestKey' is distinct from new.input_json->'automaticHookText'->>'requestKey'
    or coalesce(auto_text->>'status','') not in ('ready','needs_review') then raise exception 'automatic_hook_text_receipt_invalid'; end if;
  select id,duration_seconds into asset_id,asset_duration from public.media_assets
    where id=(new.output_json->>'mediaAssetId')::uuid and user_id=new.user_id and source_record_id=new.id::text
      and collection='video' and status='ready' and deleted_at is null;
  if not found then raise exception 'automatic_hook_text_asset_unavailable'; end if;
  update public.media_assets set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('automaticHookText',jsonb_build_object('version',1,'status',auto_text->>'status','requestKey',auto_text->>'requestKey')) where id=asset_id;
  if auto_text->>'status' <> 'ready' then return new; end if;
  editing := auto_text->'editing';
  if editing->>'version' is distinct from '1' or editing->>'format' is distinct from 'hook'
    or editing->>'trimStartMs' is distinct from '0' or jsonb_typeof(editing->'textOverlays') is distinct from 'array'
    or jsonb_array_length(editing->'textOverlays') not between 1 and 20
    or (editing->>'trimEndMs')::numeric not between 1000 and 120000
    or (editing->>'trimEndMs')::numeric > asset_duration*1000+50 then raise exception 'automatic_hook_text_edit_invalid'; end if;
  perform pg_advisory_xact_lock(hashtextextended('explore-clip:'||new.user_id||':hook:'||asset_id::text,0));
  insert into public.explore_clip_drafts(user_id,scope,source_asset_id,revision,content)
    values(new.user_id,'hook',asset_id,1,jsonb_build_object('version',1,'sourceAssetId',asset_id,'editing',editing,'backgroundAssetId',null,'backgroundPlayback','once'))
    on conflict(user_id,scope,source_asset_id) do nothing;
  return new;
end; $$;
revoke all on function public.explore_initialize_automatic_hook_text() from public,anon,authenticated;
grant execute on function public.explore_initialize_automatic_hook_text() to service_role;
create trigger explore_initialize_automatic_hook_text after update of status,output_json on public.background_jobs
  for each row when (new.status='completed') execute function public.explore_initialize_automatic_hook_text();
