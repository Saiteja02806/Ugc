create table if not exists public.product_feedback_attachment_uploads (
  id uuid primary key,
  user_id text not null
    check (char_length(user_id) between 1 and 128),
  storage_key text not null unique
    check (char_length(storage_key) between 1 and 1000),
  file_name text not null
    check (char_length(file_name) between 1 and 255),
  mime_type text not null
    check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes bigint not null
    check (file_size_bytes between 1 and 10485760),
  status text not null default 'pending'
    check (status in ('pending', 'attached')),
  feedback_id uuid unique references public.product_feedback(id) on delete set null,
  created_at timestamptz not null default now(),
  attached_at timestamptz
);

comment on table public.product_feedback_attachment_uploads is
  'Service-only, short-lived image-upload records for authenticated product feedback.';

alter table public.product_feedback_attachment_uploads enable row level security;

revoke all privileges on table public.product_feedback_attachment_uploads
  from public, anon, authenticated, service_role;

grant select, insert, update
  on table public.product_feedback_attachment_uploads to service_role;

create index if not exists product_feedback_attachment_uploads_user_created_idx
  on public.product_feedback_attachment_uploads (user_id, created_at desc);

alter table public.product_feedback
  add column if not exists attachment_upload_id uuid
    unique references public.product_feedback_attachment_uploads(id),
  add column if not exists attachment_storage_key text,
  add column if not exists attachment_file_name text,
  add column if not exists attachment_mime_type text,
  add column if not exists attachment_size_bytes bigint,
  add column if not exists attachment_width integer,
  add column if not exists attachment_height integer;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'product_feedback_attachment_metadata_check'
      and conrelid = 'public.product_feedback'::regclass
  ) then
    alter table public.product_feedback
      add constraint product_feedback_attachment_metadata_check
      check (
        (
          attachment_upload_id is null
          and attachment_storage_key is null
          and attachment_file_name is null
          and attachment_mime_type is null
          and attachment_size_bytes is null
          and attachment_width is null
          and attachment_height is null
        )
        or (
          attachment_upload_id is not null
          and attachment_storage_key is not null
          and attachment_file_name is not null
          and attachment_mime_type in ('image/jpeg', 'image/png', 'image/webp')
          and attachment_size_bytes between 1 and 10485760
          and attachment_width between 1 and 10000
          and attachment_height between 1 and 10000
        )
      );
  end if;
end $$;
