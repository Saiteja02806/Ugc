alter table public.social_oauth_sessions
  add column if not exists intent text not null default 'add',
  add column if not exists expected_connection_id uuid;

alter table public.social_oauth_sessions
  drop constraint if exists social_oauth_sessions_intent_check,
  drop constraint if exists social_oauth_sessions_reconnect_target_check,
  drop constraint if exists social_oauth_sessions_expected_connection_fkey;

alter table public.social_oauth_sessions
  add constraint social_oauth_sessions_intent_check
    check (intent in ('add', 'reconnect')),
  add constraint social_oauth_sessions_reconnect_target_check
    check (
      (intent = 'add' and expected_connection_id is null) or
      (intent = 'reconnect' and expected_connection_id is not null)
    ),
  add constraint social_oauth_sessions_expected_connection_fkey
    foreign key (expected_connection_id)
    references public.social_connections(id)
    on delete cascade;

create index if not exists social_oauth_sessions_reconnect_target_idx
  on public.social_oauth_sessions (expected_connection_id)
  where expected_connection_id is not null;

select pg_notify('pgrst', 'reload schema');
