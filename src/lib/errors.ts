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

export function toUserFacingMessage(error: unknown, fallbackMessage: string): string {
  return error instanceof UserFacingError ? error.message : fallbackMessage
}
