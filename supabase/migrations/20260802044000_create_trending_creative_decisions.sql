alter table public.user_carousel_assignments
  drop constraint if exists user_carousel_assignments_state_check;
alter table public.user_carousel_assignments
  add constraint user_carousel_assignments_state_check check (
    state in (
      'pending',
      'in_progress',
      'accepted',
      'completed_skipped',
      'completed_saved',
      'completed_scheduled',
      'failed'
    )
  );

alter table public.user_carousel_assignments
  drop constraint if exists user_carousel_assignments_completion_action_check;
alter table public.user_carousel_assignments
  add constraint user_carousel_assignments_completion_action_check check (
    completion_action is null
    or completion_action in ('accepted', 'skipped', 'saved', 'scheduled')
  );

create table if not exists public.trending_creative_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (char_length(trim(user_id)) > 0),
  assignment_id uuid not null,
  creative_id uuid not null,
  format text not null
    check (format in ('carousel', 'hook_video', 'wall_text')),
  decision text not null
    check (decision in ('accepted', 'rejected')),
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint trending_creative_decisions_creative_key unique (
    user_id,
    format,
    creative_id
  ),
  constraint trending_creative_decisions_assignment_key unique (
    format,
    assignment_id
  )
);

create index if not exists trending_creative_decisions_user_decided_idx
  on public.trending_creative_decisions (user_id, decided_at desc);

alter table public.trending_creative_decisions enable row level security;

revoke all privileges on table public.trending_creative_decisions
  from anon, authenticated;
grant select, insert on table public.trending_creative_decisions
  to service_role;

create or replace function public.record_trending_creative_decision(
  p_user_id text,
  p_format text,
  p_assignment_id uuid,
  p_creative_id uuid,
  p_decision text
)
returns setof public.trending_creative_decisions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  recorded public.trending_creative_decisions;
  assignment_is_active boolean := false;
  assignment_exists boolean := false;
  decided_at_value timestamptz := now();
begin
  if char_length(trim(coalesce(p_user_id, ''))) = 0
    or p_format not in ('carousel', 'hook_video', 'wall_text')
    or p_assignment_id is null
    or p_creative_id is null
    or p_decision not in ('accepted', 'rejected')
  then
    raise exception 'trending_creative_decision_invalid_scope';
  end if;

  case p_format
    when 'carousel' then
      select
        true,
        assignment.state in ('pending', 'in_progress')
      into assignment_exists, assignment_is_active
      from public.user_carousel_assignments as assignment
      where assignment.id = p_assignment_id
        and assignment.user_id = p_user_id
        and assignment.carousel_id = p_creative_id
      for update;
    when 'hook_video' then
      select
        true,
        assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_hook_video_assignments as assignment
      where assignment.id = p_assignment_id
        and assignment.user_id = p_user_id
        and assignment.hook_suggestion_id = p_creative_id
      for update;
    when 'wall_text' then
      select
        true,
        assignment.state = 'active'
      into assignment_exists, assignment_is_active
      from public.user_wall_text_assignments as assignment
      where assignment.id = p_assignment_id
        and assignment.user_id = p_user_id
        and assignment.wall_text_creative_id = p_creative_id
      for update;
  end case;

  if not coalesce(assignment_exists, false) then
    raise exception 'trending_creative_decision_assignment_not_found';
  end if;

  select decision.*
  into recorded
  from public.trending_creative_decisions as decision
  where decision.user_id = p_user_id
    and decision.format = p_format
    and decision.creative_id = p_creative_id;

  if found then
    if recorded.assignment_id <> p_assignment_id
      or recorded.decision <> p_decision
    then
      raise exception 'trending_creative_decision_conflict';
    end if;

    return next recorded;
    return;
  end if;

  if not coalesce(assignment_is_active, false) then
    raise exception 'trending_creative_decision_assignment_inactive';
  end if;

  insert into public.trending_creative_decisions (
    assignment_id,
    creative_id,
    decided_at,
    decision,
    format,
    user_id
  )
  values (
    p_assignment_id,
    p_creative_id,
    decided_at_value,
    p_decision,
    p_format,
    p_user_id
  )
  returning * into recorded;

  case p_format
    when 'carousel' then
      update public.user_carousel_assignments
      set
        completed_at = decided_at_value,
        completion_action = case
          when p_decision = 'accepted' then 'accepted'
          else 'skipped'
        end,
        state = case
          when p_decision = 'accepted' then 'accepted'
          else 'completed_skipped'
        end,
        updated_at = decided_at_value
      where id = p_assignment_id;
    when 'hook_video' then
      update public.user_hook_video_assignments
      set
        completed_at = decided_at_value,
        last_opened_at = case
          when p_decision = 'accepted' then decided_at_value
          else last_opened_at
        end,
        state = case
          when p_decision = 'accepted' then 'selected'
          else 'completed_skipped'
        end,
        updated_at = decided_at_value
      where id = p_assignment_id;
    when 'wall_text' then
      update public.user_wall_text_assignments
      set
        completed_at = decided_at_value,
        last_opened_at = case
          when p_decision = 'accepted' then decided_at_value
          else last_opened_at
        end,
        state = case
          when p_decision = 'accepted' then 'selected'
          else 'completed_skipped'
        end,
        updated_at = decided_at_value
      where id = p_assignment_id;
  end case;

  return next recorded;
end;
$$;

revoke all on function public.record_trending_creative_decision(
  text,
  text,
  uuid,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.record_trending_creative_decision(
  text,
  text,
  uuid,
  uuid,
  text
) to service_role;

select pg_notify('pgrst', 'reload schema');
