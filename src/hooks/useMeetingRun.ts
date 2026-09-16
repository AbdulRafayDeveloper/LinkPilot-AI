"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { MEETINGS_ENDPOINT, MEETING_MESSAGES, RUNNING_STATUSES } from "@/constants/meetings"
import type { MeetingStatusId } from "@/constants/meetings"
import type { MeetingRunState } from "@/types/meetings"

/**
 * Drives one meeting's analysis from the page: call, then call again while there is more to do.
 *
 * Each call reads a few chunks and returns, so no request has to stay open for a long meeting and
 * the work survives anything that ends a call. Leaving the page only stops the calling: everything
 * already read is saved, and opening the meeting again carries on from there.
 */
export function useMeetingRun(onProgress: (state: MeetingRunState) => void) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)
  const progressRef = useRef(onProgress)
  useEffect(() => {
    progressRef.current = onProgress
  }, [onProgress])

  // Leaving the page stops the calling; the run itself picks up where it left off next time
  useEffect(
    () => () => {
      stopRef.current = true
    },
    []
  )

  const run = useCallback(async (id: string, options: { restart?: boolean } = {}) => {
    stopRef.current = false
    setIsRunning(true)
    setError(null)
    let restart = options.restart ?? false
    try {
      for (let call = 0; call < 500; call++) {
        if (stopRef.current) break
        const { data } = await requestApi<MeetingRunState>(`${MEETINGS_ENDPOINT}/${id}/process`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ restart }),
        })
        restart = false
        progressRef.current(data)
        if (!data.hasMore || data.status === "failed") break
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : MEETING_MESSAGES.analysisFailed)
    } finally {
      setIsRunning(false)
    }
  }, [])

  return { run, isRunning, error, clearError: () => setError(null) }
}

export const isRunningStatus = (status: MeetingStatusId) => RUNNING_STATUSES.includes(status)
