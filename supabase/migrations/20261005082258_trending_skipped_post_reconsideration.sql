-- Only the explicit reconsideration RPC may change a rejected decision.
-- Keep the decision identity and original reviewed timestamp for daily counts.
alter table public.trending_creative_decisions
  add column if not exists reconsidered_at timestamptz;

create or replace function public.record_trending_creative_decision (
  p_user_id text,
  p_format text,
  p_assignment_id uuid,
  p_creative_id uuid,
  p_decision text
)
returns setof public.trending_creative_decisions
language plpgsql
set search_path to ''
as $$
declare
  recorded public.trending_creative_decisions;
  assignment_is_active boolean := false;
  assignment_exists boolean := false;
  decided_at_value timestamptz := now();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_format not in ('carousel', 'hook_video', 'wall_text', 'reaction')
    or p_assignment_id is null
    or p_creative_id is null
    or p_decision not in ('accepted', 'rejected') then
    raise exception 'trending_creative_decision_invalid_scope';
  end if;

  case p_format
    when 'carousel' then
      select true, assignment.state in ('pending', 'in_progress')
      into assignment_exists, assignment_is_active
      from public.user_carousel_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.carousel_id = p_creative_id for update;
    when 'hook_video' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_hook_video_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.hook_suggestion_id = p_creative_id for update;
    when 'wall_text' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_wall_text_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.wall_text_creative_id = p_creative_id for update;
    when 'reaction' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_reaction_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.reaction_creative_id = p_creative_id for update;
  end case;

  if not coalesce(assignment_exists, false) then
    raise exception 'trending_creative_decision_assignment_not_found';
  end if;

  select decision.* into recorded
  from public.trending_creative_decisions as decision
  where decision.user_id = p_user_id
    and decision.format = p_format
    and decision.creative_id = p_creative_id;

  if found then
    if recorded.assignment_id <> p_assignment_id then
      raise exception 'trending_creative_decision_conflict';
    end if;
    if recorded.decision <> p_decision and not (
      p_decision = 'rejected' and recorded.decision = 'accepted'
      and recorded.reconsidered_at is not null
    ) then
      raise exception 'trending_creative_decision_conflict';
    end if;
    -- A delayed original skip cannot undo an explicit reconsideration.
    return next recorded;
    return;
  end if;

  if not coalesce(assignment_is_active, false) then
    raise exception 'trending_creative_decision_assignment_inactive';
  end if;

  insert into public.trending_creative_decisions (
    assignment_id, creative_id, decided_at, decision, format, user_id
  ) values (
    p_assignment_id, p_creative_id, decided_at_value, p_decision, p_format, p_user_id
  ) returning * into recorded;

  if p_format = 'reaction' then
    update public.user_reaction_assignments
    set completed_at = decided_at_value,
        last_opened_at = case when p_decision = 'accepted' then decided_at_value else last_opened_at end,
        state = case when p_decision = 'accepted' then 'selected' else 'completed_skipped' end,
        updated_at = decided_at_value
    where id = p_assignment_id;
  elsif p_format = 'carousel' then
    update public.user_carousel_assignments
    set completed_at = decided_at_value,
        completion_action = case when p_decision = 'accepted' then 'accepted' else 'skipped' end,
        state = case when p_decision = 'accepted' then 'accepted' else 'completed_skipped' end,
        updated_at = decided_at_value
    where id = p_assignment_id;
  elsif p_format = 'hook_video' then
    update public.user_hook_video_assignments
    set completed_at = decided_at_value,
        last_opened_at = case when p_decision = 'accepted' then decided_at_value else last_opened_at end,
        state = case when p_decision = 'accepted' then 'selected' else 'completed_skipped' end,
        updated_at = decided_at_value
    where id = p_assignment_id;
  else
    update public.user_wall_text_assignments
    set completed_at = decided_at_value,
        last_opened_at = case when p_decision = 'accepted' then decided_at_value else last_opened_at end,
        state = case when p_decision = 'accepted' then 'selected' else 'completed_skipped' end,
        updated_at = decided_at_value
    where id = p_assignment_id;
  end if;

  return next recorded;
end;
$$;

create or replace function public.reconsider_skipped_trending_creative (
  p_user_id text, p_format text, p_assignment_id uuid, p_creative_id uuid
)
returns setof public.trending_creative_decisions
language plpgsql
set search_path to ''
as $$
declare
  recorded public.trending_creative_decisions;
  assignment_exists boolean := false;
  assignment_is_active boolean := false;
  reconsidered_at_value timestamptz := now();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_format not in ('carousel', 'hook_video', 'wall_text', 'reaction')
    or p_assignment_id is null or p_creative_id is null then
    raise exception 'trending_creative_decision_invalid_scope';
  end if;

  -- Take the same assignment lock as the ordinary decision RPC before
  -- locking its decision row. This serializes a skip still in the outbox.
  case p_format
    when 'carousel' then
      select true, assignment.state in ('pending', 'in_progress')
      into assignment_exists, assignment_is_active
      from public.user_carousel_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.carousel_id = p_creative_id for update;
    when 'hook_video' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_hook_video_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.hook_suggestion_id = p_creative_id for update;
    when 'wall_text' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_wall_text_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.wall_text_creative_id = p_creative_id for update;
    when 'reaction' then
      select true, assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_reaction_assignments as assignment
      where assignment.id = p_assignment_id and assignment.user_id = p_user_id
        and assignment.reaction_creative_id = p_creative_id for update;
  end case;


  if not coalesce(assignment_exists, false) then
    raise exception 'trending_creative_decision_assignment_not_found';
  end if;
  select decision.* into recorded
  from public.trending_creative_decisions as decision
  where decision.user_id = p_user_id and decision.format = p_format
    and decision.creative_id = p_creative_id for update;
  if found then
    if recorded.assignment_id <> p_assignment_id then
      raise exception 'trending_creative_decision_conflict';
    end if;
    if recorded.decision = 'accepted' then
      return next recorded;
      return;
    end if;
  else
    -- Persist the original skip first when the browser has not delivered it.
    -- The ordinary RPC still enforces active assignment ownership.
    select * into recorded from public.record_trending_creative_decision(
      p_user_id, p_format, p_assignment_id, p_creative_id, 'rejected'
    );
  end if;

  update public.trending_creative_decisions
  set decision = 'accepted', reconsidered_at = reconsidered_at_value
  where id = recorded.id returning * into recorded;

  case p_format
    when 'carousel' then
      update public.user_carousel_assignments
      set state = 'accepted', completion_action = 'accepted', updated_at = reconsidered_at_value
      where id = p_assignment_id;
    when 'hook_video' then
      update public.user_hook_video_assignments
      set state = 'selected', last_opened_at = reconsidered_at_value, updated_at = reconsidered_at_value
      where id = p_assignment_id;
    when 'wall_text' then
      update public.user_wall_text_assignments
      set state = 'selected', last_opened_at = reconsidered_at_value, updated_at = reconsidered_at_value
      where id = p_assignment_id;
    when 'reaction' then
      update public.user_reaction_assignments
      set state = 'selected', last_opened_at = reconsidered_at_value, updated_at = reconsidered_at_value
      where id = p_assignment_id;
  end case;
  return next recorded;
end;
$$;

revoke all on function public.reconsider_skipped_trending_creative(text, text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.reconsider_skipped_trending_creative(text, text, uuid, uuid)
  to postgres, service_role;
