export class SchedulingRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
    public readonly code = "invalid_schedule_request",
  ) {
    super(message);
    this.name = "SchedulingRequestError";
  }
}
