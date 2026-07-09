export class WebsiteAnalysisError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "WebsiteAnalysisError";
    this.status = status;
  }
}
