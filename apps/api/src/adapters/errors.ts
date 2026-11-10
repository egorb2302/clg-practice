export class PermanentError extends Error {}

export class RetryLaterError extends Error {
  constructor(
    message: string,
    public retryAfterSec: number,
  ) {
    super(message);
  }
}
