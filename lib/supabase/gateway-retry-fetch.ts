// PostgREST already retries 503/520 and network failures. Cover gateway
// failures separately, only for reads, without replaying writes or RPCs.
const GATEWAY_STATUSES = new Set([502, 504, 522, 524]);

export function createGatewayRetryFetch(
  request: typeof fetch = (...args) => fetch(...args),
  delay: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms)),
): typeof fetch {
  return async (input, init) => {
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const signal = init?.signal ?? (input instanceof Request ? input.signal : undefined);
    for (let attempt = 0; ; attempt += 1) {
      signal?.throwIfAborted();
      const response = await request(input, init);
      if (
        (method !== "GET" && method !== "HEAD") ||
        !GATEWAY_STATUSES.has(response.status) ||
        attempt >= 2 || signal?.aborted
      ) return response;
      await response.body?.cancel();
      await delay(250 * 2 ** attempt);
    }
  };
}

export const gatewayRetryFetch = createGatewayRetryFetch();
