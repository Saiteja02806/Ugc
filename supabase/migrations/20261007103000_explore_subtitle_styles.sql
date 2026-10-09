-- Keep the renderer/browser IDs in sync with worker/src/subtitles/styles.ts.
-- NOT VALID preserves historical receipts while enforcing all new writes.
ALTER TABLE public.explore_video_finishes
  ADD CONSTRAINT explore_finish_subtitle_style_check CHECK (
    draft->'subtitles' IS NULL OR draft->'subtitles' = 'null'::jsonb OR coalesce((
      jsonb_typeof(draft->'subtitles') = 'object'
      AND draft->'subtitles'->>'language' = 'en'
      AND draft->'subtitles'->>'style' IN
        ('clean','bold-box','active-word','editorial','word-pop','karaoke','marker-highlight')
      AND (NOT (draft->'subtitles' ? 'placement') OR
        draft->'subtitles'->>'placement' IN ('bottom','middle','top'))
    ), false)
  ) NOT VALID;
