-- These are internal server-owned reservation/recovery transactions.
-- Firebase authorization occurs in the application; public RPC callers must
-- not be able to supply another user's identity to a SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.replace_partial_daily_carousel_refill_batch_if_profile_current(text,uuid,integer,uuid,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.replace_partial_daily_carousel_refill_batch_if_profile_current(text,uuid,integer,uuid,uuid,integer) TO service_role, postgres;
REVOKE ALL ON FUNCTION public.reserve_daily_carousel_refill_batch_if_profile_current(text,uuid,integer,uuid,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_daily_carousel_refill_batch_if_profile_current(text,uuid,integer,uuid,integer) TO service_role, postgres;
