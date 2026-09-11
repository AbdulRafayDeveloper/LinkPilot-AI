import type { ApiEnvelope } from "@/types/api"

/**
 * Calls an internal API route that returns the standard envelope. Resolves with the
 * data and message, or throws an Error carrying the server's user-safe message.
 */
export async function requestApi<T>(url: string, init?: RequestInit): Promise<{ data: T; message?: string }> {
  const response = await fetch(url, { cache: "no-store", ...init })
  let body: ApiEnvelope<T> | null = null
  try {
    body = (await response.json()) as ApiEnvelope<T>
  } catch {
    // Non-JSON response; handled below
  }
  if (!body?.success || body.data === undefined) {
    throw new Error(body?.message || "The server returned an unexpected response.")
  }
  return { data: body.data, message: body.message }
}
