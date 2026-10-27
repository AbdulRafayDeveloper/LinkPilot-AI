"use client"

import React, { useEffect, useState } from "react"
import Image from "next/image"
import { CalendarClock, Eye, Loader2, MessageSquareQuote, NotebookPen, Video } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { RichTextView } from "@/components/ui/RichTextView"
import { MeetingAnalysisView } from "@/components/meetings/MeetingAnalysisView"
import { RecordingVideo } from "@/components/meetings/RecordingVideo"
import { requestApi } from "@/lib/apiClient"
import { formatOffset } from "@/lib/recordingParts"
import { SITE_LOGO_PNG, SITE_NAME } from "@/config/site"
import { PUBLIC_MEETING_ENDPOINT, PUBLIC_MEETING_MESSAGES } from "@/constants/meetings"
import type { PublicMeeting } from "@/types/meetings"
import type { MeetingRecordingLinks } from "@/types/meetingRecording"
import { formatInstant } from "@/lib/timeZone"

const when = (iso: string) =>
  formatInstant(iso, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

/**
 * What a meeting's shared link opens, for someone who is not signed in to anything: **the recording
 * first**, because watching it is the point of the link, then the summary, the notes and what the
 * analysis made of the meeting.
 *
 * **It reads and nothing else.** There is no chat here and nothing to change: the owner shares a
 * recording to be watched, not a workspace to be worked in. There is no transcript either (the
 * video says everything it would), and nothing that names the account, the client or any id.
 *
 * **It is full width**, like an employee's plan link and a project's: no middle column, just the
 * page's own side padding, so a wide video has the whole screen to play in.
 */
export default function PublicMeetingClient({ token }: { token: string }) {
  const [meeting, setMeeting] = useState<PublicMeeting | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [links, setLinks] = useState<MeetingRecordingLinks | null>(null)
  const [linksError, setLinksError] = useState<string | null>(null)

  const endpoint = `${PUBLIC_MEETING_ENDPOINT}/${token}`

  useEffect(() => {
    const controller = new AbortController()
    requestApi<PublicMeeting>(endpoint, { signal: controller.signal })
      .then(({ data }) => setMeeting(data))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setError(reason instanceof Error ? reason.message : PUBLIC_MEETING_MESSAGES.invalid)
      })
    return () => controller.abort()
  }, [endpoint])

  // The video's links are signed and short-lived, so they are read once the meeting says there is one
  useEffect(() => {
    if (!meeting?.hasVideo) return
    const controller = new AbortController()
    requestApi<MeetingRecordingLinks>(`${endpoint}/recording`, { signal: controller.signal })
      .then(({ data }) => setLinks(data))
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setLinksError(reason instanceof Error ? reason.message : PUBLIC_MEETING_MESSAGES.noVideo)
      })
    return () => controller.abort()
  }, [endpoint, meeting?.hasVideo])

  return (
    <div className="font-body-md text-body-md min-h-screen bg-background text-on-surface">
      <header className="border-b border-outline-variant bg-surface-container-lowest">
        <div className="flex w-full items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <Image src={SITE_LOGO_PNG} alt="" width={24} height={24} className="rounded-md" />
          <span className="text-[13px] font-semibold text-on-surface">{SITE_NAME}</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-semibold text-on-primary-fixed-variant">
            <Eye size={12} aria-hidden="true" />
            {PUBLIC_MEETING_MESSAGES.readOnly}
          </span>
        </div>
      </header>

      <main className="flex w-full flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        {error ? (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest px-4 py-16 short:py-5 text-center">
            <CalendarClock size={22} className="text-outline" aria-hidden="true" />
            <p className="text-sm text-on-surface-variant">{error}</p>
          </div>
        ) : !meeting ? (
          <p role="status" className="flex items-center justify-center gap-2 py-16 short:py-5 text-sm text-on-surface-variant">
            <Loader2 size={18} className="animate-spin text-primary" aria-hidden="true" />
            Loading the meeting...
          </p>
        ) : (
          <>
            <section className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-4">
              <h1 className="min-w-0 break-words text-xl font-bold text-on-surface">{meeting.title}</h1>
              {/* A div, not a p: on a short laptop window globals.css hides the one-line description
                  under a page's h1, and when this meeting was recorded and how long it runs is a
                  fact about the recording rather than a description of the page */}
              <div className="mt-1 text-[12px] text-outline">
                {when(meeting.createdAt)}
                {meeting.durationMs !== null && ` · ${formatOffset(meeting.durationMs)}`}
              </div>
            </section>

            {/* The recording, first: it is what the link was sent for */}
            <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
              <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
                <Video size={16} className="text-primary" aria-hidden="true" />
                Recording
              </h2>
              {!meeting.hasVideo ? (
                <p className="text-[12px] text-on-surface-variant">{PUBLIC_MEETING_MESSAGES.noVideo}</p>
              ) : links?.screen ? (
                <RecordingVideo screen={links.screen} camera={links.camera} />
              ) : linksError ? (
                <p role="alert" className="text-[12px] text-error">
                  {linksError}
                </p>
              ) : (
                <p className="flex items-center gap-2 text-[12px] text-on-surface-variant">
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  Loading the video...
                </p>
              )}
            </section>

            {/* The summary, then the notes, then everything else the analysis found. The notes are
                built from the analysis and open with the summary, so the summary gets a card of its
                own only when there are none, rather than saying the same three lines twice over */}
            {!meeting.notes && meeting.minutes && (
              <section className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
                    <MessageSquareQuote size={16} className="text-primary" aria-hidden="true" />
                    Summary
                  </h2>
                  <CopyButton text={meeting.minutes} label="Copy the summary" />
                </div>
                <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-surface-variant">{meeting.minutes}</p>
              </section>
            )}

            {meeting.notes && (
              <section className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
                    <NotebookPen size={16} className="text-primary" aria-hidden="true" />
                    Notes
                  </h2>
                  <CopyButton text={meeting.notes} label="Copy the notes" />
                </div>
                <RichTextView text={meeting.notes} />
              </section>
            )}

            {meeting.analysis ? (
              <MeetingAnalysisView analysis={meeting.analysis} />
            ) : (
              <p className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 text-center text-sm text-on-surface-variant shadow-sm">
                {PUBLIC_MEETING_MESSAGES.notAnalysed}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
