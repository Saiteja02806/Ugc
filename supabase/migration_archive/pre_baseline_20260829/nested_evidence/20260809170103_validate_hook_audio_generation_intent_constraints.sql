-- Existing Hook suggestions are legacy rows without v6 intent and satisfy both
-- compatibility checks. Validate now so Postgres records the full table as safe.
alter table public.hook_video_suggestions
  validate constraint hook_video_suggestions_audio_intent_check;

alter table public.hook_video_suggestions
  validate constraint hook_video_suggestions_v6_audio_intent_required;
