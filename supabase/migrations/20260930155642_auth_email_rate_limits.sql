-- Firebase owns authentication. These counters only protect email delivery.
CREATE TABLE public.auth_email_rate_limits (
  bucket_hash text PRIMARY KEY CHECK (bucket_hash ~ '^[a-f0-9]{64}$'),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  last_request_at timestamptz,
  expires_at timestamptz NOT NULL
);
CREATE INDEX auth_email_rate_limits_expiry ON public.auth_email_rate_limits (expires_at);
ALTER TABLE public.auth_email_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auth_email_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.auth_email_rate_limits TO service_role;

CREATE FUNCTION public.consume_auth_email_limits(p_buckets jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  b record;
  counter public.auth_email_rate_limits%ROWTYPE;
  current_time_at timestamptz := pg_catalog.clock_timestamp();
  wait_seconds integer;
BEGIN
  IF p_buckets IS NULL OR pg_catalog.jsonb_typeof(p_buckets) <> 'array' THEN
    RAISE EXCEPTION 'Invalid email rate-limit buckets';
  END IF;
  IF pg_catalog.jsonb_array_length(p_buckets) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'Invalid email rate-limit buckets';
  END IF;
  IF (SELECT count(DISTINCT value->>'key') FROM pg_catalog.jsonb_array_elements(p_buckets)) <
      pg_catalog.jsonb_array_length(p_buckets) THEN
    RAISE EXCEPTION 'Duplicate or missing email rate-limit bucket';
  END IF;
  -- Bounded housekeeping, skipping counters held by concurrent transactions.
  DELETE FROM public.auth_email_rate_limits WHERE bucket_hash IN (
    SELECT bucket_hash FROM public.auth_email_rate_limits
    WHERE expires_at < current_time_at - interval '1 day'
    ORDER BY expires_at, bucket_hash LIMIT 100 FOR UPDATE SKIP LOCKED
  );
  -- Always lock in the same order; all buckets are consumed atomically.
  FOR b IN SELECT * FROM pg_catalog.jsonb_to_recordset(p_buckets)
    AS x(key text, window_seconds integer, max_requests integer, cooldown_seconds integer)
    ORDER BY key
  LOOP
    IF b.key IS NULL OR b.key !~ '^[a-f0-9]{64}$' OR
       b.window_seconds IS NULL OR b.window_seconds NOT BETWEEN 1 AND 86400 OR
       b.max_requests IS NULL OR b.max_requests NOT BETWEEN 1 AND 10000 OR
       b.cooldown_seconds IS NULL OR b.cooldown_seconds NOT BETWEEN 0 AND b.window_seconds THEN
      RAISE EXCEPTION 'Invalid email rate-limit bucket';
    END IF;
    PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('auth-email:' || b.key, 0));
    INSERT INTO public.auth_email_rate_limits (bucket_hash, expires_at)
      VALUES (b.key, current_time_at + b.window_seconds * interval '1 second')
      ON CONFLICT (bucket_hash) DO NOTHING;
    SELECT * INTO counter FROM public.auth_email_rate_limits WHERE bucket_hash = b.key FOR UPDATE;
    IF counter.expires_at <= current_time_at THEN
      UPDATE public.auth_email_rate_limits SET request_count = 0, last_request_at = NULL,
        expires_at = current_time_at + b.window_seconds * interval '1 second' WHERE bucket_hash = b.key;
      counter.request_count := 0;
      counter.last_request_at := NULL;
      counter.expires_at := current_time_at + b.window_seconds * interval '1 second';
    END IF;
    IF counter.request_count >= b.max_requests THEN
      wait_seconds := greatest(1, ceil(extract(epoch FROM counter.expires_at - current_time_at))::integer);
      RETURN pg_catalog.jsonb_build_object('allowed', false, 'retry_after', wait_seconds);
    END IF;
    IF counter.last_request_at IS NOT NULL AND
       counter.last_request_at + b.cooldown_seconds * interval '1 second' > current_time_at THEN
      wait_seconds := greatest(1, ceil(extract(epoch FROM counter.last_request_at + b.cooldown_seconds * interval '1 second' - current_time_at))::integer);
      RETURN pg_catalog.jsonb_build_object('allowed', false, 'retry_after', wait_seconds);
    END IF;
  END LOOP;
  UPDATE public.auth_email_rate_limits SET request_count = request_count + 1,
    last_request_at = current_time_at
    WHERE bucket_hash IN (SELECT value->>'key' FROM pg_catalog.jsonb_array_elements(p_buckets));
  RETURN pg_catalog.jsonb_build_object('allowed', true, 'retry_after', 0);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_auth_email_limits(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_auth_email_limits(jsonb) TO service_role;
