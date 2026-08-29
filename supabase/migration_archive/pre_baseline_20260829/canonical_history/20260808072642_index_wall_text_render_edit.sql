create index if not exists user_wall_text_assignments_render_edit_idx
  on public.user_wall_text_assignments (render_edit_id)
  where render_edit_id is not null;
