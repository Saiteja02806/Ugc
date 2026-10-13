-- Additive caption-review drafts; no paid-provider policy or old receipt changes.
alter table public.explore_video_finishes add constraint explore_caption_preview_valid
  check (not (draft ? 'captionPreview') or coalesce((
    draft->'captionPreview' = 'true'::jsonb and draft->'subtitles'->>'version' = '2'
  ), false));

-- A transcript-only result is never a publishing asset, including through RPC.
do $$
declare definition text;
begin
  select pg_get_functiondef('public.explore_finalize_video_finish(text,uuid,uuid,uuid,jsonb)'::regprocedure) into definition;
  if position('if not found or saved.status=' in definition) = 0 then raise exception 'explore_finalize_review_required'; end if;
  definition := replace(definition, 'if not found or saved.status=', 'if not found or saved.draft->>''captionPreview'' = ''true'' or saved.status=');
  execute definition;
  select pg_get_functiondef('public.explore_create_video_finish(text,uuid,text,jsonb)'::regprocedure) into definition;
  if position('''outputAssetId'',output_id)' in definition) = 0 then raise exception 'explore_create_review_required'; end if;
  -- The router reads this server-created marker, never a browser URL. Only
  -- the bounded v2 subtitle flow uses HTTP; legacy/heavy renders keep Jobs.
  definition := replace(definition, '''outputAssetId'',output_id)', '''outputAssetId'',output_id) || case when p_draft->''subtitles''->>''version'' = ''2'' then ''{"interactiveFinishingVersion":1}''::jsonb else ''{}''::jsonb end');
  execute definition;
end;
$$;
