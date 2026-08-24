create table if not exists public.product_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id text not null
    check (char_length(user_id) between 1 and 128),
  user_email text
    check (user_email is null or char_length(user_email) <= 320),
  user_display_name text
    check (user_display_name is null or char_length(user_display_name) <= 160),
  feedback_type text not null
    check (feedback_type in ('support_ticket', 'feature_request')),
  title text not null
    check (char_length(title) between 3 and 120),
  description text not null
    check (char_length(description) between 10 and 4000),
  source_path text
    check (source_path is null or char_length(source_path) <= 500),
  user_agent text
    check (user_agent is null or char_length(user_agent) <= 1000),
  status text not null default 'new'
    check (status in ('new', 'reviewing', 'planned', 'resolved', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.product_feedback is
  'Authenticated support tickets and feature requests submitted from Settings. The table is service-role only so customer identity and feedback are never exposed through the browser Data API.';

alter table public.product_feedback enable row level security;

revoke all privileges on table public.product_feedback
  from public, anon, authenticated, service_role;

grant select, insert, update
  on table public.product_feedback to service_role;

create index if not exists product_feedback_status_created_idx
  on public.product_feedback (status, created_at desc);

create index if not exists product_feedback_user_created_idx
  on public.product_feedback (user_id, created_at desc);
