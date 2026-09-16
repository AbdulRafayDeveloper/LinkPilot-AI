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
