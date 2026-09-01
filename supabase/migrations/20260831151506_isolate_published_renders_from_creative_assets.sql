-- Saved is an explicit user choice. A selected Wall assignment is eligible to
-- render or schedule, but must not appear in Creative Assets until the user
-- chooses Save to Creative Assets.
ALTER TABLE public.user_wall_text_assignments
  ADD COLUMN IF NOT EXISTS library_saved_at timestamptz;

CREATE INDEX IF NOT EXISTS user_wall_text_assignments_library_saved_idx
  ON public.user_wall_text_assignments (user_id, library_saved_at DESC)
  WHERE library_saved_at IS NOT NULL;

-- Older rows did not record that choice. Preserve the rows that have a render
-- request and were never linked to a Wall schedule; scheduled/published rows
-- intentionally remain outside Saved Creative Assets.
UPDATE public.user_wall_text_assignments AS assignment
SET library_saved_at = COALESCE(assignment.render_requested_at, assignment.updated_at)
WHERE assignment.library_saved_at IS NULL
  AND assignment.state = 'selected'
  AND assignment.render_requested_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.scheduled_posts AS schedule
    WHERE schedule.user_id = assignment.user_id
      AND schedule.metadata ->> 'wallTextAssignmentId' = assignment.id::text
  );
