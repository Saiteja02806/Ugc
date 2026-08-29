alter table public.category_image_assets
  add column if not exists has_human boolean,
  add column if not exists visual_setting text,
  add column if not exists visual_style text,
  add column if not exists source_query text,
  add column if not exists content_tags jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'category_image_assets_content_tags_array_chk'
      and conrelid = 'public.category_image_assets'::regclass
  ) then
    alter table public.category_image_assets
      add constraint category_image_assets_content_tags_array_chk
      check (jsonb_typeof(content_tags) = 'array')
      not valid;
  end if;
end $$;

alter table public.category_image_assets
  validate constraint category_image_assets_content_tags_array_chk;

with normalized_assets as (
  select
    id,
    coalesce(source_query, image_query, '') as raw_query,
    lower(coalesce(source_query, image_query, '')) as query_text
  from public.category_image_assets
)
update public.category_image_assets
set
  source_query = nullif(normalized_assets.raw_query, ''),
  has_human = normalized_assets.query_text ~
    '(team|people|person|woman|man|founder|creator|professional|worker|freelancer|entrepreneur|meeting|collaboration|startup|work|working|laptop|remote)',
  visual_setting = case
    when normalized_assets.query_text ~ '(coffee|cafe)'
      then 'coffee-shop'
    when normalized_assets.query_text ~ '(home office|working from home|work from home)'
      then 'home-office'
    when normalized_assets.query_text ~ '(meeting|whiteboard|collaboration|team|technology meeting)'
      then 'meeting'
    when normalized_assets.query_text ~ '(office|professional|corporate)'
      then 'office'
    when normalized_assets.query_text ~ '(desk|workspace|laptop|remote|startup)'
      then 'workspace'
    else 'neutral-background'
  end,
  visual_style = case
    when normalized_assets.query_text ~ '(creator|filming|content)'
      then 'creator'
    when normalized_assets.query_text ~ '(founder|entrepreneur|startup)'
      then 'founder'
    when normalized_assets.query_text ~ '(team|meeting|collaboration|technology meeting)'
      then 'team'
    when normalized_assets.query_text ~ '(coffee|cafe|home|casual|freelancer|remote|woman|man|people|person|young)'
      then 'casual'
    when normalized_assets.query_text ~ '(office|professional|corporate|business)'
      then 'corporate'
    else 'lifestyle'
  end,
  content_tags = to_jsonb(
    array_remove(
      array[
        case
          when normalized_assets.query_text ~
            '(team|people|person|woman|man|founder|creator|professional|worker|freelancer|entrepreneur|meeting|collaboration|startup|work|working|laptop|remote)'
            then 'human'
        end,
        case
          when normalized_assets.query_text ~ '(laptop|computer|desk|workspace)'
            then 'laptop'
        end,
        case
          when normalized_assets.query_text ~ '(coffee|cafe)'
            then 'coffee-shop'
        end,
        case
          when normalized_assets.query_text ~ '(home office|working from home|work from home)'
            then 'home-office'
        end,
        case
          when normalized_assets.query_text ~ '(creator|filming|content)'
            then 'creator'
        end,
        case
          when normalized_assets.query_text ~ '(founder|entrepreneur|startup)'
            then 'founder'
        end,
        case
          when normalized_assets.query_text ~ '(team|meeting|collaboration|technology meeting)'
            then 'team'
        end,
        case
          when normalized_assets.query_text ~ '(casual|freelancer|remote|coffee|cafe|home)'
            then 'casual'
        end
      ]::text[],
      null
    )
  )
from normalized_assets
where public.category_image_assets.id = normalized_assets.id;

create index if not exists category_image_assets_ready_style_idx
  on public.category_image_assets (category_slug, status, visual_style, usage_count, created_at);

create index if not exists category_image_assets_ready_setting_idx
  on public.category_image_assets (category_slug, status, visual_setting, usage_count, created_at);
