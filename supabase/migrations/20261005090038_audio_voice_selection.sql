-- Use It is independent of bookmarking. Only verified-owner server routes
-- may access these preferences; stored IDs never grant private voice access.
create table public.audio_voice_preferences (
  user_id text primary key check (char_length(user_id) between 1 and 128),
  voice_id text not null check (voice_id ~ '^[A-Za-z0-9_-]{1,100}$')
);
alter table public.audio_voice_preferences enable row level security;
revoke all on table public.audio_voice_preferences from public, anon, authenticated, service_role;
grant select, insert, update on table public.audio_voice_preferences to service_role;
