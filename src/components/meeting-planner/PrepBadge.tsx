"use client"

import React from "react"
import { AlertTriangle, Loader2, Sparkles } from "lucide-react"
import type { MeetingPlan } from "@/types/meetingPlanner"

type PrepState = "ready" | "running" | "failed"

/** Whether a meeting has preparation to show, is still writing it, or couldn't; null when it has none. */
export function prepStateOf(meeting: Pick<MeetingPlan, "prepEnabled" | "prepStatus">): PrepState | null {
  if (!meeting.prepEnabled) return null
  if (meeting.prepStatus === "ready") return "ready"
  if (meeting.prepStatus === "queued" || meeting.prepStatus === "generating") return "running"
  if (meeting.prepStatus === "failed") return "failed"
  return null
}

const LOOK: Record<PrepState, { label: string; className: string }> = {
  // Filled, so a meeting with its preparation written stands out from the ones without
  ready: { label: "Prep ready", className: "bg-primary text-white" },
  running: { label: "Preparing...", className: "bg-primary-fixed text-on-primary-fixed-variant" },
  failed: { label: "Prep failed", className: "bg-error-container text-error" },
}

const DESCRIPTION: Record<PrepState, string> = {
  ready: "Preparation ready: open the meeting to read it",
  running: "Preparation is being written",
  failed: "Preparation didn't finish: open the meeting to try again",
}

/**
 * A labelled tag saying a meeting's preparation is written (or being written, or failed), next to
 * the meeting wherever it is listed. Nothing for a meeting without preparation, so the tag itself is
 * what tells the two apart.
 */
export const PrepBadge: React.FC<{ meeting: Pick<MeetingPlan, "prepEnabled" | "prepStatus">; className?: string }> = ({ meeting, className = "" }) => {
  const state = prepStateOf(meeting)
  if (!state) return null
  const { label, className: look } = LOOK[state]
  const Icon = state === "ready" ? Sparkles : state === "running" ? Loader2 : AlertTriangle
  return (
    <span
      title={DESCRIPTION[state]}
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold ${look} ${className}`}
    >
      <Icon size={11} className={state === "running" ? "animate-spin" : ""} aria-hidden="true" />
      {label}
      <span className="sr-only">. {DESCRIPTION[state]}</span>
    </span>
  )
}
