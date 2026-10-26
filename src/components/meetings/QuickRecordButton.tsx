"use client"

import React from "react"
import { useRouter } from "next/navigation"
import { Circle, Video } from "lucide-react"
import { meetingRecorder } from "@/lib/meetingRecorder"
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder"
import { QUICK_RECORDING, RECORDING_MESSAGES } from "@/constants/meetingRecording"

const RECORD_PAGE = "/meetings/record"

interface QuickRecordButtonProps {
  /**
   * The planned meeting this records, when it is started from Meeting Planner. The recording is linked
   * to it from the start and carries its name; left out, it is an ordinary recording.
   */
  plan?: { id: string; name: string }
  // `button` is a labelled button for a page header; `icon` fits a calendar row beside its other controls
  variant?: "button" | "icon"
}

/**
 * One click to record, with the record page's own defaults (your voice, the laptop's sound and the
 * microphone, no camera). The recorder is started **from this click**, because a browser only opens
 * its screen picker for one, and the record page is opened straight after to show the clock, the
 * meters and Stop; the recorder lives outside React, so moving page never stops it. While something is
 * already being recorded the button just goes to that recording instead of starting a second.
 */
export const QuickRecordButton: React.FC<QuickRecordButtonProps> = ({ plan, variant = "button" }) => {
  const router = useRouter()
  const recorder = useMeetingRecorder()
  const isBusy = ["starting", "recording", "paused", "stopping", "finishing"].includes(recorder.status)

  const start = () => {
    if (!isBusy) {
      // A finished or failed recording still on show is put away first, so this one starts clean
      meetingRecorder.reset()
      void meetingRecorder.start({ ...QUICK_RECORDING, title: plan?.name ?? "", plan: plan ?? null })
    }
    router.push(RECORD_PAGE)
  }

  const label = isBusy ? "Go to the recording" : plan ? RECORDING_MESSAGES.recordThis(plan.name) : RECORDING_MESSAGES.quickRecord
  const hint = isBusy ? "A recording is already running in this tab" : RECORDING_MESSAGES.quickRecordHint

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={start}
        aria-label={label}
        title={`${label}. ${hint}`}
        className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-error/5 hover:text-error ${
          isBusy ? "text-error" : "text-outline"
        }`}
      >
        <Video size={14} aria-hidden="true" />
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={start}
      title={hint}
      className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-error px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-error/90"
    >
      <Circle size={12} className={`fill-current ${isBusy ? "animate-pulse" : ""}`} aria-hidden="true" />
      {isBusy ? "Recording..." : plan ? "Record this meeting" : RECORDING_MESSAGES.quickRecord}
    </button>
  )
}
