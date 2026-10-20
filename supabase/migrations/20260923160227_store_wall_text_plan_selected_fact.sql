-- A Wall plan chooses a fact before writing. Persist that choice only after
-- the owning generation chunk has been claimed, so retries use the identical
-- fact and no browser-facing table mutation is needed.

create or replace function public.set_wall_text_generation_assignment_grounding_v1(
  p_assignment_id uuid,
  p_batch_id uuid,
  p_focus_json jsonb,
  p_user_id text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_assignment_id uuid;
begin
  if p_focus_json is null then
    raise exception 'wall_text_grounding_required';
  end if;

  select assignment.id into v_assignment_id
  from public.wall_text_generation_assignments as assignment
  join public.wall_text_generation_batches as batch
    on batch.id = assignment.batch_id
  where assignment.id = p_assignment_id
    and assignment.batch_id = p_batch_id
    and batch.user_id = p_user_id
    and assignment.status = 'processing'
  for update of assignment;

  if not found then
    raise exception 'wall_text_generation_assignment_unavailable';
  end if;

  update public.wall_text_generation_assignments
  set focus_json = p_focus_json,
      updated_at = now()
  where id = v_assignment_id;

  return v_assignment_id;
end;
$$;

revoke all on function public.set_wall_text_generation_assignment_grounding_v1(uuid, uuid, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.set_wall_text_generation_assignment_grounding_v1(uuid, uuid, jsonb, text)
  to service_role;

select pg_notify('pgrst', 'reload schema');
