export class RetryableJobError extends Error {
  readonly code: string;
  readonly retryAfterSeconds: number;
  readonly retryAt: string;

  constructor(
    message: string,
    params: {
      code: string;
      now?: number;
      retryAfterSeconds: number;
    },
  ) {
    super(message);
    this.code = params.code;
    this.name = "RetryableJobError";
    this.retryAfterSeconds = Math.max(
      1,
      Math.min(43_200, Math.ceil(params.retryAfterSeconds)),
    );
    this.retryAt = new Date(
      (params.now ?? Date.now()) + this.retryAfterSeconds * 1_000,
    ).toISOString();
  }
}

// A durable wait is different from a provider failure. The job should go back
// to the queue at a known time without using one of its provider retry
// attempts (for example, while another post is publishing to the same account).
export class DeferredJobError extends RetryableJobError {
  constructor(
    message: string,
    params: {
      code: string;
      now?: number;
      retryAfterSeconds: number;
    },
  ) {
    super(message, params);
    this.name = "DeferredJobError";
  }
}
