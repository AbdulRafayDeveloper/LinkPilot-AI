"use client"

import { useSyncExternalStore } from "react"
import { meetingRecorder, type RecorderSnapshot } from "@/lib/meetingRecorder"

/**
 * The tab's meeting recorder as the page sees it. The recorder itself lives in `lib/meetingRecorder`,
 * so it keeps recording and uploading while the user moves around the app; this only reads it.
 */
export function useMeetingRecorder(): RecorderSnapshot {
  return useSyncExternalStore(meetingRecorder.subscribe, meetingRecorder.getSnapshot, meetingRecorder.getServerSnapshot)
}
