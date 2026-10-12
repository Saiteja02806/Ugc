ALTER TABLE public.generation_provider_operations
  DROP CONSTRAINT generation_provider_operations_provider_check;

ALTER TABLE public.generation_provider_operations
  ADD CONSTRAINT generation_provider_operations_provider_check
  CHECK (provider = ANY (ARRAY['gemini', 'higgsfield', 'openai', 'runway', 'veo']));
