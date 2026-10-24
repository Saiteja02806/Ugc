-- Single-use MCP confirmation tokens. The token itself is an HMAC; this table
-- records the consumed id so a second isolate cannot replay it. Service role
-- only. Enable with MCP_CONFIRM_TOKEN_DURABLE=true after this migration is applied.
CREATE TABLE public.mcp_confirm_tokens (
  jti text PRIMARY KEY,
  account_id text NOT NULL,
  tool text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.mcp_confirm_tokens ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.mcp_confirm_tokens FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON TABLE public.mcp_confirm_tokens TO service_role;

CREATE INDEX mcp_confirm_tokens_expires_at_idx ON public.mcp_confirm_tokens (expires_at);
