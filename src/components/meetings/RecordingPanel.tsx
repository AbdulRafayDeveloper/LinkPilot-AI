"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FileText, Loader2, RefreshCw, Video } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { RecordingVideo } from "@/components/meetings/RecordingVideo"
import { useRecordingRun } from "@/hooks/useRecordingRun"
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder"
import { RECORDING_MESSAGES, recordingEndpoint } from "@/constants/meetingRecording"
import { formatOffset } from "@/lib/recordingParts"
import type { MeetingRecordingLinks, MeetingRecordingSummary } from "@/types/meetingRecording"

interface RecordingPanelProps {
  meetingId: string
  recording: MeetingRecordingSummary
  // Called once the transcript is on the meeting, so the page reads it again and the analysis starts
  onTranscribed: () => void
  onProgress: (recording: MeetingRecordingSummary) => void
}

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

const Bar: React.FC<{ label: string; done: number; total: number }> = ({ label, done, total }) => {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-[12px] text-on-surface-variant">
        <span>{label}</span>
        <span className="tabular-nums">
          {done} of {total}
        </span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

/**
 * The recording on the meeting page: where it is while it is joined (and the calls that move it on),
 * then the video to play and download, with the camera in a corner when there is one.
 *
 * A joined recording **waits at `ready`** with a Transcribe and analyse button: nothing is written out
 * or analysed until that is pressed, so a recording costs nothing until it is wanted. Once pressed, the
 * writing out runs here and the page's own analysis takes over when the transcript lands.
 */
export const RecordingPanel: React.FC<RecordingPanelProps> = ({ meetingId, recording, onTranscribed, onProgress }) => {
  const recorder = useMeetingRecorder()
  const [links, setLinks] = useState<MeetingRecordingLinks | null>(null)
  const [linksError, setLinksError] = useState<string | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const startedRef = useRef(false)

  const { run, isRunning, error: runError } = useRecordingRun(
    useCallback(
      (summary: MeetingRecordingSummary, hasMore: boolean) => {
        onProgress(summary)
        if (!hasMore && summary.stage === "done") onTranscribed()
      },
      [onProgress, onTranscribed]
    )
  )

  const isProcessing = recording.stage === "consolidating" || recording.stage === "transcribing"
  // The joined video exists from `ready` on, so it can be watched before anything is written out
  const isJoined = recording.stage === "ready" || recording.stage === "transcribing" || recording.stage === "done"
  // This tab is still recording it, or still sending its last chunks
  const isRecordingHere = recorder.meetingId === meetingId && ["recording", "paused", "stopping", "finishing"].includes(recorder.status)

  // Joining starts by itself once, and so does writing out that was already asked for (left mid-way);
  // a ready recording is never written out from here without the click
  useEffect(() => {
    if (!isProcessing || startedRef.current || isRunning) return
    startedRef.current = true
    void run(meetingId)
  }, [isProcessing, isRunning, run, meetingId])

  // The links are read once there is a joined video to play
  useEffect(() => {
    if (!isJoined) return
    const controller = new AbortController()
    requestApi<MeetingRecordingLinks>(recordingEndpoint(meetingId), { signal: controller.signal })
      .then(({ data }) => setLinks(data))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLinksError(error instanceof Error ? error.message : RECORDING_MESSAGES.processFailed)
      })
    return () => controller.abort()
  }, [meetingId, isJoined])

  const transcribe = () => {
    startedRef.current = true
    void run(meetingId, { transcribe: true })
  }

  const finishPartial = async () => {
    setIsFinishing(true)
    setFinishError(null)
    try {
      const { data } = await requestApi<MeetingRecordingSummary>(
        `${recordingEndpoint(meetingId)}/finish`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partial: true }) },
        { retry: true }
      )
      onProgress(data)
      startedRef.current = true
      void run(meetingId)
    } catch (error: unknown) {
      setFinishError(error instanceof Error ? error.message : RECORDING_MESSAGES.processFailed)
    } finally {
      setIsFinishing(false)
    }
  }

  const uploaded = recording.uploadedBytes.screen + recording.uploadedBytes.camera + recording.uploadedBytes.audio

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-surface-container-lowest p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-sm font-bold text-on-surface">
        <Video size={16} className="text-primary" aria-hidden="true" />
        Recording
        {recording.durationMs !== null && (
          <span className="font-normal text-outline">
            · {formatOffset(recording.durationMs)} · {megabytes(uploaded)}
          </span>
        )}
      </h2>

      {recording.stage === "recording" &&
        (isRecordingHere ? (
          <p className="text-[12px] text-on-surface-variant">
            This meeting is being recorded in this tab.{" "}
            <Link href="/meetings/record" className="font-semibold text-primary underline">
              Go to the recording
            </Link>
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-[12px] text-on-surface-variant">
              This recording didn&apos;t finish: the page recording it was closed, or it is still running somewhere else. {megabytes(uploaded)} reached
              storage. If nothing is recording it any more, finish it with what arrived.
            </p>
            <button
              type="button"
              onClick={() => void finishPartial()}
              disabled={isFinishing}
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover disabled:opacity-60"
            >
              {isFinishing && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              Finish with what was uploaded
            </button>
          </div>
        ))}

      {isProcessing && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="flex items-center gap-2 text-[12px] font-semibold text-primary">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {recording.stage === "consolidating" ? "Joining the recording into one video..." : "Writing out what was said (Groq)..."}
            <span className="font-normal text-on-surface-variant">You can leave this page; it carries on when you come back.</span>
          </p>
          {/* One bar for the step running now: a zero "written out" bar while joining read as if
              writing out had been queued by itself, which it never is */}
          {recording.stage === "consolidating" ? (
            <Bar label="Chunks joined" done={recording.joined.done} total={recording.joined.total} />
          ) : (
            <Bar label="Audio pieces written out" done={recording.transcribed.done} total={recording.transcribed.total} />
          )}
        </div>
      )}

      {recording.stage === "ready" && (
        <div className="flex flex-col gap-2 rounded-xl border border-primary/30 bg-primary/5 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[12px] text-on-surface-variant">
            {RECORDING_MESSAGES.readyToTranscribe} <span className="text-outline">{RECORDING_MESSAGES.transcribeHint}</span>
          </p>
          <button
            type="button"
            onClick={transcribe}
            disabled={isRunning}
            className="inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
          >
            {isRunning ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
            {RECORDING_MESSAGES.transcribe}
          </button>
        </div>
      )}

      {(recording.stage === "failed" || runError || finishError) && (
        <div role="alert" className="flex flex-col gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
          <p className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {finishError ?? runError ?? recording.error ?? RECORDING_MESSAGES.processFailed}
          </p>
          {recording.stage !== "recording" && (
            <button
              type="button"
              // A failure while joining carries on joining and stops at ready again; one after joining
              // can only have been in the writing out that was already asked for, so that carries on
              onClick={() => void run(meetingId, { transcribe: recording.joined.done >= recording.joined.total })}
              disabled={isRunning}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-error/40 bg-surface-container-lowest px-3 py-1.5 font-semibold text-error hover:bg-error/5 disabled:opacity-60"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      )}

      {isJoined &&
        (links?.screen ? (
          <RecordingVideo screen={links.screen} camera={links.camera} />
        ) : linksError ? (
          <p className="text-[12px] text-error">{linksError}</p>
        ) : links ? (
          <p className="text-[12px] text-on-surface-variant">Only the audio of this recording was kept.</p>
        ) : (
          <p className="flex items-center gap-2 text-[12px] text-on-surface-variant">
            <Loader2 size={13} className="animate-spin" aria-hidden="true" />
            Loading the video...
          </p>
        ))}
    </section>
  )
}
