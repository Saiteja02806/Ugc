insert into public.hook_formats (
  id,
  display_name,
  description,
  audio_mode,
  status
)
values (
  'airplane_reaction',
  'Airplane reaction',
  'Influencer reacting while seated in an airplane cabin or beside an airplane window.',
  'dynamic',
  'active'
)
on conflict (id) do nothing;
