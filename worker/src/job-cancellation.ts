export class JobCancellationRequestedError extends Error {
  constructor() {
    super("Background job cancellation was requested.");
    this.name = "JobCancellationRequestedError";
  }
}
