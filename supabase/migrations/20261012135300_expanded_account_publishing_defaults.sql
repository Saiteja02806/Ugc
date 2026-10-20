-- Account defaults initialize new posts only. Saved schedule targets are immutable.
alter table public.user_publishing_preferences
  add column tiktok_privacy_level text not null default 'PUBLIC_TO_EVERYONE'
    check (tiktok_privacy_level in ('PUBLIC_TO_EVERYONE', 'SELF_ONLY', 'FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS')),
  add column tiktok_allow_comments boolean not null default true,
  add column youtube_privacy_status text not null default 'public'
    check (youtube_privacy_status in ('public', 'private', 'unlisted')),
  add column youtube_made_for_kids boolean not null default false,
  add column youtube_notify_subscribers boolean not null default false;

-- Keep Firebase-owned preferences available only through the authenticated API.
alter table public.user_publishing_preferences enable row level security;
revoke all on public.user_publishing_preferences from public, anon, authenticated;
grant select, insert, update on public.user_publishing_preferences to service_role;
