export class CuteMarketsApiError extends Error {
  public readonly status: number;
  public readonly code?: string;
  public readonly requestId?: string;
  public readonly rateLimit?: unknown;

  constructor(
    message: string,
    options: { status: number; code?: string; requestId?: string; rateLimit?: unknown },
  ) {
    super(message);
    this.name = "CuteMarketsApiError";
    this.status = options.status;
    this.code = options.code;
    this.requestId = options.requestId;
    this.rateLimit = options.rateLimit;
  }
}
