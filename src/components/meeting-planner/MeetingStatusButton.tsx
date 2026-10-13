"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Ban, Check, CheckCircle2, Circle, Loader2 } from "lucide-react"
import { MEETING_PLAN_STATUSES, type MeetingPlanStatusId } from "@/constants/meetingPlanner"
import type { MeetingPlan } from "@/types/meetingPlanner"

interface MeetingStatusButtonProps {
  meeting: MeetingPlan
  isSaving: boolean
  onChange: (meeting: MeetingPlan, status: MeetingPlanStatusId) => void
}

// What the menu takes up, so it can be placed before it is rendered; it is clamped to the window.
// The height is the three options measured (161px, Cancelled's description wrapping to two lines)
// with a little over, since it is only used to decide whether the menu opens below the chip or above it
const MENU_WIDTH = 192
const MENU_HEIGHT = 170

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
export const MeetingStatusButton: React.FC<MeetingStatusButtonProps> = ({ meeting, isSaving, onChange }) => {
  // Where the menu sits on screen, or null while it is closed; it is placed from the chip's own
  // position rather than under it in the markup, so a scrolling list can never clip it
  const [menuAt, setMenuAt] = useState<{ top: number; left: number } | null>(null)
  const wrapper = useRef<HTMLDivElement>(null)
  const chip = useRef<HTMLButtonElement>(null)
  const isOpen = menuAt !== null
  const look = STATUS_LOOK[meeting.status] ?? STATUS_LOOK.pending
  const label = statusLabel(meeting.status)

  const close = useCallback(() => setMenuAt(null), [])

  const open = () => {
    const rect = chip.current?.getBoundingClientRect()
    if (!rect) return
    // Below the chip, or above it when the window has no room, then clamped inside the window on
    // every edge, so it is whole wherever the chip itself happens to be
    const roomBelow = window.innerHeight - rect.bottom - 8
    const preferred = roomBelow >= MENU_HEIGHT ? rect.bottom + 4 : rect.top - MENU_HEIGHT - 4
    setMenuAt({
      top: Math.max(8, Math.min(preferred, window.innerHeight - MENU_HEIGHT - 8)),
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
    })
  }

  // A click anywhere else, Escape, or the page moving under it closes the menu: it is positioned
  // once, so scrolling would otherwise leave it floating away from its chip
  useEffect(() => {
    if (!isOpen) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!wrapper.current?.contains(target) && !(target instanceof Element && target.closest("[data-meeting-status-menu]"))) close()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close()
    }
    document.addEventListener("pointerdown", onPointerDown)
    document.addEventListener("keydown", onKeyDown)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      document.removeEventListener("pointerdown", onPointerDown)
      document.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [isOpen, close])

  const choose = (status: MeetingPlanStatusId) => {
    close()
    if (status !== meeting.status) onChange(meeting, status)
  }

  return (
    <div ref={wrapper} className="relative shrink-0">
      <button
        ref={chip}
        type="button"
        onClick={() => (isOpen ? close() : open())}
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
        {label}
      </button>

      {menuAt &&
        createPortal(
          <div
            role="menu"
            aria-label="Meeting status"
            data-meeting-status-menu=""
            style={{ top: menuAt.top, left: menuAt.left, width: MENU_WIDTH }}
            className="fixed z-[70] overflow-hidden rounded-xl border border-outline-variant bg-white py-1 shadow-lg"
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
          </div>,
          document.body
        )}
    </div>
  )
}
