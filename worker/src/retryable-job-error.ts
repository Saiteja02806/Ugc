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
