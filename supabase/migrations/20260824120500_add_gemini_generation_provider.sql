alter table public.generation_provider_operations
  drop constraint if exists generation_provider_operations_provider_check;

alter table public.generation_provider_operations
  add constraint generation_provider_operations_provider_check
  check (provider in ('gemini', 'openai', 'runway', 'veo'));

select pg_notify('pgrst', 'reload schema');
