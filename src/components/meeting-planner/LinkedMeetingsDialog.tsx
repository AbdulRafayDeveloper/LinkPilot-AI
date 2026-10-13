"use client"

import React, { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronRight, FileText, Loader2, Video } from "lucide-react"
import { Modal } from "@/components/ui/Modal"
import { requestApi } from "@/lib/apiClient"
import { MEETING_PLAN_LINK_MESSAGES } from "@/constants/meetings"
import { MEETING_PLANNER_ENDPOINT } from "@/constants/meetingPlanner"
import { dayLabel, formatTime } from "@/lib/meetingDates"
import type { LinkedMeeting } from "@/types/meetings"
import type { MeetingPlan } from "@/types/meetingPlanner"

interface LinkedMeetingsDialogProps {
  meeting: MeetingPlan
  onClose: () => void
}

const sizeOf = (chars: number): string =>
  chars >= 1000 ? `${Math.round(chars / 1000).toLocaleString()}k characters` : `${chars} characters`

/**
 * What a planned meeting on the calendar has been written up as: the notes and recordings linked to
 * it (Meeting Notes to Tasks), each opening its own page.
 *
 * It is the calendar's half of the link; the other half is on the meetings list, where the records
 * are picked and linked to an event. The records are read when the popup opens rather than carried
 * by the month, because a month of them would be a list nobody is looking at.
 */
export const LinkedMeetingsDialog: React.FC<LinkedMeetingsDialogProps> = ({ meeting, onClose }) => {
  const [linked, setLinked] = useState<LinkedMeeting[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    requestApi<{ meetings: LinkedMeeting[] }>(`${MEETING_PLANNER_ENDPOINT}/${meeting.id}/meetings`, { signal: controller.signal })
      .then(({ data }) => {
        setLinked(data.meetings)
        setError(null)
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : MEETING_PLAN_LINK_MESSAGES.linkFailed)
      })
    return () => controller.abort()
  }, [meeting.id])

  return (
    <Modal
      title={MEETING_PLAN_LINK_MESSAGES.notesTitle}
      description={`"${meeting.name}" · ${dayLabel(meeting.meetingDate, { weekday: "short", month: "short" })} at ${formatTime(meeting.meetingTime)}`}
      onClose={onClose}
      size="compact"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
          >
            Close
          </button>
        </div>
      }
    >
      {linked === null && !error ? (
        <p role="status" className="flex items-center gap-2 py-6 text-[13px] text-on-surface-variant">
          <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
          Loading what is linked...
        </p>
      ) : error ? (
        <p role="alert" className="rounded-xl bg-error-container px-3 py-2.5 text-[13px] text-error">
          {error}
        </p>
      ) : linked && linked.length === 0 ? (
        <p className="rounded-xl border border-dashed border-outline-variant px-3 py-6 text-center text-[13px] text-outline">
          {MEETING_PLAN_LINK_MESSAGES.notesEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(linked ?? []).map((record) => (
            <li key={record.id}>
              <Link
                href={`/meetings/${record.id}`}
                className="group flex items-start gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-3 transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                {/* What it is: a recording made in the app, or a transcript that was pasted in */}
                {record.hasRecording ? (
                  <Video size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                ) : (
                  <FileText size={15} className="mt-0.5 shrink-0 text-outline" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-on-surface group-hover:text-primary">{record.title}</span>
                  <span className="mt-0.5 block text-[11px] text-outline">
                    {record.hasRecording ? "Recorded in the app" : "Transcript"} · {sizeOf(record.transcriptChars)} ·{" "}
                    {new Date(record.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
                  </span>
                </span>
                <ChevronRight size={14} className="mt-0.5 shrink-0 text-outline" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
