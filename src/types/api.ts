/**
 * Standard JSON envelope returned by the API routes.
 */
export interface ApiEnvelope<T> {
  success: boolean
  message?: string
  data?: T
}
