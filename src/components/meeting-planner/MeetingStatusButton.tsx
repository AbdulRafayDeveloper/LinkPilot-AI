"use client"

import React from "react"
import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import type { MeetingPlan } from "@/types/meetingPlanner"

interface MeetingStatusButtonProps {
  meeting: MeetingPlan
  isSaving: boolean
  onToggle: (meeting: MeetingPlan) => void
  // Compact sits inside a list row; full is used where there is room for the word
  size?: "compact" | "full"
}

/**
 * The status, as a button. Completed is green and pending is plain, and one click switches
 * between them wherever the meeting is shown.
 */
export const MeetingStatusButton: React.FC<MeetingStatusButtonProps> = ({ meeting, isSaving, onToggle, size = "full" }) => {
  const isDone = meeting.status === "completed"
  const label = isDone ? "Completed" : "Pending"
  return (
    <button
      type="button"
      onClick={() => onToggle(meeting)}
      disabled={isSaving}
      aria-pressed={isDone}
      aria-label={`${meeting.name}: ${label}. ${isDone ? "Mark as pending" : "Mark as completed"}`}
      title={isDone ? "Mark as pending" : "Mark as completed"}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        isDone
          ? "border-success/40 bg-success-container text-on-success-container hover:bg-success-container/70"
          : "border-outline-variant bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-high"
      }`}
    >
      {isSaving ? (
        <Loader2 size={13} className="animate-spin" aria-hidden="true" />
      ) : isDone ? (
        <CheckCircle2 size={13} aria-hidden="true" />
      ) : (
        <Circle size={13} aria-hidden="true" />
      )}
      {size === "full" && label}
    </button>
  )
}
