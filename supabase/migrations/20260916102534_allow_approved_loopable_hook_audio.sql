-- A Hook + Demo render uses one soundtrack for the entire composition. The
-- former constraint made an explicitly reviewed loop impossible, which forced
-- short audio to end before the Demo. Human review and active status remain
-- mandatory; per-video locks intentionally remain non-looping through their
-- existing validation trigger.
alter table public.hook_audio_assets
  drop constraint if exists hook_audio_assets_loopable_check;

comment on column public.hook_audio_assets.loopable is
  'True only when human review has approved seamless looping for a Hook + Demo composition. Video locks remain non-looping.';

select pg_notify('pgrst', 'reload schema');
