-- Firebase identities are verified by the audio API. Direct Data API clients
-- cannot access account preferences; only that owner-scoped server path can.
create table public.audio_voice_bookmarks (
  user_id text not null check (char_length(user_id) between 1 and 128),
  voice_id text not null check (voice_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, voice_id)
);

alter table public.audio_voice_bookmarks enable row level security;
revoke all on table public.audio_voice_bookmarks from public, anon, authenticated, service_role;
grant select, insert, delete on table public.audio_voice_bookmarks to service_role;

comment on table public.audio_voice_bookmarks is
  'Owner-scoped voice preferences. Bookmarking does not grant audio generation or private voice access.';
