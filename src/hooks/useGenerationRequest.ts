"use client"

import { requestApi } from "@/lib/apiClient"
import { createToolStore, useToolStore, type ToolStore } from "@/lib/toolStore"

export type GenerationStatus = "idle" | "loading" | "success" | "error"

export interface GenerationState<TResult> {
  status: GenerationStatus
  result: TResult | null
  error: string | null
}

export interface GenerationRequest<TPayload, TResult> {
  store: ToolStore<GenerationState<TResult>>
  generate: (payload: TPayload) => Promise<void>
  // Cancels any running request and clears the result
  reset: () => void
}

const idle = <TResult>(): GenerationState<TResult> => ({ status: "idle", result: null, error: null })

/**
 * One tool's generation request against a JSON API route. Create it once at module level:
 * the state lives outside the page, so a result (or a request still running) is there
 * when the user comes back to the tool. Starting a new request cancels the previous one
 * and clears its result, so an old result is never shown alongside a new one.
 */
export function createGenerationRequest<TPayload, TResult>(
  name: string,
  endpoint: string,
  fallbackError: string,
  // Bump when TResult changes shape, so a result saved by an older version is ignored
  { resultVersion = 1 }: { resultVersion?: number } = {}
): GenerationRequest<TPayload, TResult> {
  const store = createToolStore<GenerationState<TResult>>(`${name}:result`, idle<TResult>(), {
    version: resultVersion,
    // Only a finished result survives a refresh; a running request can't resume after one
    toStored: (state) => (state.status === "success" ? state : idle<TResult>()),
    // The store name is the tool's route
    activity: { href: `/${name}`, statusOf: (state) => state.status },
  })
  let controller: AbortController | null = null

  const generate = async (payload: TPayload) => {
    controller?.abort()
    const current = new AbortController()
    controller = current
    store.update({ status: "loading", result: null, error: null })

    try {
      const { data } = await requestApi<TResult>(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: current.signal,
      })
      if (current.signal.aborted) return
      store.update({ status: "success", result: data })
    } catch (err: unknown) {
      if (current.signal.aborted) return
      // Network failures surface as TypeError; server errors carry a user-safe message
      const message = err instanceof Error && !(err instanceof TypeError) ? err.message : ""
      store.update({ status: "error", error: message || fallbackError })
    }
  }

  const reset = () => {
    controller?.abort()
    controller = null
    store.reset()
  }

  return { store, generate, reset }
}

export function useGenerationRequest<TPayload, TResult>(request: GenerationRequest<TPayload, TResult>) {
  const { status, result, error } = useToolStore(request.store)
  return { status, result, error, generate: request.generate, reset: request.reset }
}
