create index if not exists hook_formats_locked_audio_asset_idx
  on public.hook_formats (locked_audio_asset_id)
  where locked_audio_asset_id is not null;

create index if not exists hook_audio_selections_suggestion_idx
  on public.hook_audio_selections (hook_video_suggestion_id);

create index if not exists hook_audio_selections_format_idx
  on public.hook_audio_selections (hook_format_id);
