/**
 * An error whose message is safe to show to the user, such as missing configuration
 * or an unavailable settings store. Anything else is replaced by a generic message.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "UserFacingError"
  }
}

/**
 * Keeps an error that already says what went wrong, such as a provider rejecting a key, and
 * only falls back to the general message when there is nothing more specific to say. Wrapping
 * every failure in the general message is how "please try again" hid a missing key.
 */
export function asUserFacingError(error: unknown, fallbackMessage: string): UserFacingError {
  return error instanceof UserFacingError ? error : new UserFacingError(fallbackMessage)
}

export function toUserFacingMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof UserFacingError ? error.message : fallbackMessage
}

/**
 * A refusal rather than a fault: the account is not allowed to do this. It carries a message the
 * user can act on, like any UserFacingError, but a route answers **403** for it instead of 500, so a
 * refusal never reads as a server error in the logs or to the browser retry rules.
 */
export class NotAllowedError extends UserFacingError {
  constructor(message: string) {
    super(message)
    this.name = "NotAllowedError"
  }
}

/** The status a thrown error deserves: 403 for a refusal, otherwise whatever the route would have said. */
export const statusFor = (error: unknown, fallback: number): number => (error instanceof NotAllowedError ? 403 : fallback)
