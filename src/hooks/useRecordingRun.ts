"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { requestApi } from "@/lib/apiClient"
import { RECORDING_MESSAGES, recordingEndpoint } from "@/constants/meetingRecording"
import type { MeetingRecordingSummary, RecordingStepState } from "@/types/meetingRecording"

/**
 * Drives a recording's joining and writing out from the meeting page, one short step per call, calling
 * again while there is more, the way `useMeetingRun` drives the analysis. Leaving the page only stops
 * the calling: every step records where it got to, and opening the meeting again carries on.
 */
export function useRecordingRun(onProgress: (recording: MeetingRecordingSummary, hasMore: boolean) => void) {
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const stopRef = useRef(false)
  const progressRef = useRef(onProgress)
  useEffect(() => {
    progressRef.current = onProgress
  }, [onProgress])

  useEffect(
    () => () => {
      stopRef.current = true
    },
    []
  )

  const run = useCallback(async (meetingId: string) => {
    stopRef.current = false
    setIsRunning(true)
    setError(null)
    try {
      for (let call = 0; call < 2000; call++) {
        if (stopRef.current) break
        const { data } = await requestApi<RecordingStepState>(`${recordingEndpoint(meetingId)}/process`, { method: "POST" }, { retry: true })
        progressRef.current(data.recording, data.hasMore)
        if (!data.hasMore) break
      }
    } catch (requestError: unknown) {
      setError(requestError instanceof Error ? requestError.message : RECORDING_MESSAGES.processFailed)
    } finally {
      setIsRunning(false)
    }
  }, [])

  return { run, isRunning, error }
}
