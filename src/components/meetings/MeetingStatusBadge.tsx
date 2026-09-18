"use client"

import React from "react"
import { AlertTriangle, CheckCircle2, Circle, Clock, Loader2, RefreshCcw } from "lucide-react"
import { getStatusLabel, type MeetingStatusId } from "@/constants/meetings"
import type { MeetingProgress } from "@/types/meetings"

interface MeetingStatusBadgeProps {
  status: MeetingStatusId
  progress?: MeetingProgress
}

const STYLES: Record<MeetingStatusId, string> = {
  recording: "border-error/40 bg-error-container text-error",
  transcribing: "border-primary/30 bg-primary/5 text-primary",
  saved: "border-outline-variant bg-surface-container text-on-surface-variant",
  analyzing: "border-primary/30 bg-primary/5 text-primary",
  summarizing: "border-primary/30 bg-primary/5 text-primary",
  completed: "border-primary/30 bg-primary-fixed text-on-primary-fixed-variant",
  failed: "border-error/40 bg-error-container text-error",
  stale: "border-secondary-fixed-dim bg-secondary-fixed/40 text-on-secondary-fixed-variant",
}

/**
 * Where a meeting is: saved, being read, being put together, done, stopped, or out of date after
 * its transcript changed. While it is being read, the badge also says how far it has got.
 */
export const MeetingStatusBadge: React.FC<MeetingStatusBadgeProps> = ({ status, progress }) => {
  const isRunning = status === "analyzing" || status === "summarizing" || status === "transcribing"
  const Icon = status === "recording"
    ? Circle
    : isRunning
    ? Loader2
    : status === "completed"
      ? CheckCircle2
      : status === "failed"
        ? AlertTriangle
        : status === "stale"
          ? RefreshCcw
          : Clock
  const showProgress = status === "analyzing" && progress && progress.totalChunks > 0

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${STYLES[status]}`}
      aria-label={`Status: ${getStatusLabel(status)}`}
    >
      <Icon size={12} className={isRunning ? "animate-spin" : ""} aria-hidden="true" />
      {getStatusLabel(status)}
      {showProgress && ` ${progress.analyzedChunks}/${progress.totalChunks}`}
    </span>
  )
}
