-- Additive style update; leave historical receipts, ownership and recovery intact.
BEGIN;
ALTER TABLE public.explore_video_finishes DROP CONSTRAINT explore_finish_subtitle_style_check;
ALTER TABLE public.explore_video_finishes
  ADD CONSTRAINT explore_finish_subtitle_style_check CHECK (
    draft->'subtitles' IS NULL OR draft->'subtitles' = 'null'::jsonb OR coalesce((
      jsonb_typeof(draft->'subtitles') = 'object'
      AND draft->'subtitles'->>'language' = 'en'
      AND draft->'subtitles'->>'style' IN
        ('clean','bold-box','active-word','editorial','word-pop','karaoke','marker-highlight','serif-box')
      AND (NOT (draft->'subtitles' ? 'placement') OR
        draft->'subtitles'->>'placement' IN ('bottom','middle','top'))
    ), false)
  ) NOT VALID;
COMMIT;
