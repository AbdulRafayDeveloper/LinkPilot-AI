"use client"

import React, { useEffect, useRef, useState } from "react"
import { Ban, Check, CheckCircle2, Circle, Loader2 } from "lucide-react"
import { MEETING_PLAN_STATUSES, type MeetingPlanStatusId } from "@/constants/meetingPlanner"
import type { MeetingPlan } from "@/types/meetingPlanner"

interface MeetingStatusButtonProps {
  meeting: MeetingPlan
  isSaving: boolean
  onChange: (meeting: MeetingPlan, status: MeetingPlanStatusId) => void
  // Compact sits inside a list row; full is used where there is room for the word
  size?: "compact" | "full"
}

/**
 * How each status reads wherever a meeting is shown. Completed is the app's green, cancelled its
 * error red (muted, since a called-off meeting is not a fault) and pending is plain. Each carries
 * its own icon as well as its colour, so the status never rests on colour alone.
 */
export const STATUS_LOOK: Record<MeetingPlanStatusId, { chip: string; hover: string; Icon: typeof Circle }> = {
  pending: {
    chip: "border-outline-variant bg-surface-container-lowest text-on-surface-variant",
    hover: "hover:bg-surface-container-high",
    Icon: Circle,
  },
  completed: {
    chip: "border-success/40 bg-success-container text-on-success-container",
    hover: "hover:bg-success-container/70",
    Icon: CheckCircle2,
  },
  cancelled: {
    chip: "border-error/40 bg-error-container text-on-error-container",
    hover: "hover:bg-error-container/70",
    Icon: Ban,
  },
}

export const statusLabel = (status: MeetingPlanStatusId): string =>
  MEETING_PLAN_STATUSES.find((entry) => entry.id === status)?.label ?? status

/**
 * The status, as a button that opens the three statuses. It used to be a two-state toggle; a
 * meeting can now also be cancelled, and three states have no sensible single click, so the chip
 * says where the meeting stands and the menu is how it is changed.
 */
export const MeetingStatusButton: React.FC<MeetingStatusButtonProps> = ({
  meeting,
  isSaving,
  onChange,
  size = "full",
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const wrapper = useRef<HTMLDivElement>(null)
  const look = STATUS_LOOK[meeting.status] ?? STATUS_LOOK.pending
  const label = statusLabel(meeting.status)

  // A click anywhere else, or Escape, closes the menu, like every other small menu here
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setIsOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [isOpen])

  const choose = (status: MeetingPlanStatusId) => {
    setIsOpen(false)
    if (status !== meeting.status) onChange(meeting, status)
  }

  return (
    <div ref={wrapper} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        disabled={isSaving}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={`${meeting.name}: ${label}. Change the status`}
        title={`${label}. Click to change`}
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${look.chip} ${look.hover}`}
      >
        {isSaving ? (
          <Loader2 size={13} className="animate-spin" aria-hidden="true" />
        ) : (
          <look.Icon size={13} aria-hidden="true" />
        )}
        {size === "full" && label}
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Meeting status"
          className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-xl border border-outline-variant bg-white py-1 shadow-lg"
        >
          {MEETING_PLAN_STATUSES.map((status) => {
            const option = STATUS_LOOK[status.id]
            const isCurrent = status.id === meeting.status
            return (
              <button
                key={status.id}
                type="button"
                role="menuitem"
                onClick={() => choose(status.id)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-surface-container-low ${
                  isCurrent ? "bg-surface-container-low" : ""
                }`}
              >
                <option.Icon size={14} className="mt-0.5 shrink-0 text-on-surface-variant" aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold text-on-surface">{status.label}</span>
                  <span className="block text-[11px] leading-tight text-outline">{status.description}</span>
                </span>
                {isCurrent && <Check size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
