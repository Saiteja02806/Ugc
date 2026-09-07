-- Preserve the current lease implementation and grants while admitting Reaction edits.
-- This runs after Create Content has extended the same job-type allowlist.
do $$
declare
  v_definition text := pg_get_functiondef('public.claim_video_render_execution_slot(uuid,uuid,integer)'::regprocedure);
begin
  if position('''final_render''' in v_definition) > 0 then
    return;
  end if;
  if position('''render_create_content_video''' in v_definition) = 0 then
    raise exception 'Create Content render slot migration must be applied first';
  end if;
  execute replace(v_definition, '''render_create_content_video''', '''render_create_content_video'', ''final_render''');
end;
$$;
