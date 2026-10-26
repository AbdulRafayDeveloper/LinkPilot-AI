"use client"

import React from "react"
import { Video } from "lucide-react"
import type { MeetingPlan } from "@/types/meetingPlanner"

/**
 * A tag on a planned meeting that has been recorded in the app, wherever it is listed: "Recorded",
 * or "2 recordings", in words as well as the camera icon, and nothing for a meeting with no recording.
 * It is a button that opens what is linked to the meeting (`onOpen`, the calendar's own popup), so the
 * recording is one click from the calendar.
 */
export const RecordedBadge: React.FC<{ meeting: Pick<MeetingPlan, "name" | "recordedCount">; onOpen: () => void }> = ({ meeting, onOpen }) => {
  const count = meeting.recordedCount ?? 0
  if (count === 0) return null
  const words = count === 1 ? "Recorded" : `${count} recordings`
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`Open the recording${count === 1 ? "" : "s"} of ${meeting.name}`}
      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-error-container px-2 py-0.5 text-[10.5px] font-bold text-error transition-colors hover:bg-error/15"
    >
      <Video size={11} aria-hidden="true" />
      {words}
    </button>
  )
}
