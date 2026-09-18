"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Download, Loader2, RefreshCw, Video } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
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
 * The recording on the meeting page: where it is while it is joined and written out (and the calls
 * that move it on), then the video to play and download, with the camera in a corner when there is one.
 */
export const RecordingPanel: React.FC<RecordingPanelProps> = ({ meetingId, recording, onTranscribed, onProgress }) => {
  const recorder = useMeetingRecorder()
  const [links, setLinks] = useState<MeetingRecordingLinks | null>(null)
  const [linksError, setLinksError] = useState<string | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const [isFinishing, setIsFinishing] = useState(false)
  const screenRef = useRef<HTMLVideoElement>(null)
  const cameraRef = useRef<HTMLVideoElement>(null)
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
  // This tab is still recording it, or still sending its last chunks
  const isRecordingHere = recorder.meetingId === meetingId && ["recording", "paused", "stopping", "finishing"].includes(recorder.status)

  // Joining and writing out start by themselves once, and carry on from wherever they were
  useEffect(() => {
    if (!isProcessing || startedRef.current || isRunning) return
    startedRef.current = true
    void run(meetingId)
  }, [isProcessing, isRunning, run, meetingId])

  // The links are read once there is a joined video to play
  useEffect(() => {
    if (recording.stage !== "done") return
    const controller = new AbortController()
    requestApi<MeetingRecordingLinks>(recordingEndpoint(meetingId), { signal: controller.signal })
      .then(({ data }) => setLinks(data))
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setLinksError(error instanceof Error ? error.message : RECORDING_MESSAGES.processFailed)
      })
    return () => controller.abort()
  }, [meetingId, recording.stage])

  // The camera follows the screen: play, pause and seek together, drift corrected as it plays
  useEffect(() => {
    const screen = screenRef.current
    const camera = cameraRef.current
    if (!screen || !camera) return
    const follow = () => {
      if (Math.abs(camera.currentTime - screen.currentTime) > 0.3) camera.currentTime = screen.currentTime
      if (screen.paused !== camera.paused) void (screen.paused ? camera.pause() : camera.play().catch(() => undefined))
    }
    const events = ["play", "pause", "seeked", "timeupdate"] as const
    events.forEach((name) => screen.addEventListener(name, follow))
    return () => events.forEach((name) => screen.removeEventListener(name, follow))
  }, [links])

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
    <section className="flex flex-col gap-3 rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
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
              className="inline-flex w-fit items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:opacity-60"
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
          <Bar label="Chunks joined" done={recording.joined.done} total={recording.joined.total} />
          <Bar label="Audio pieces written out" done={recording.transcribed.done} total={recording.transcribed.total} />
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
              onClick={() => void run(meetingId)}
              disabled={isRunning}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-error/40 bg-white px-3 py-1.5 font-semibold text-error hover:bg-error/5 disabled:opacity-60"
            >
              <RefreshCw size={13} aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      )}

      {recording.stage === "done" &&
        (links?.screen ? (
          <div className="flex flex-col gap-2">
            <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-on-surface">
              <video ref={screenRef} src={links.screen.url} controls preload="metadata" className="aspect-video w-full" />
              {links.camera && (
                <video
                  ref={cameraRef}
                  src={links.camera.url}
                  muted
                  playsInline
                  preload="metadata"
                  aria-label="Camera"
                  className="pointer-events-none absolute bottom-12 right-3 w-1/4 max-w-[220px] rounded-lg border-2 border-white/70 shadow-lg"
                />
              )}
            </div>
            <a
              href={links.screen.downloadUrl}
              className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
            >
              <Download size={13} aria-hidden="true" />
              Download the video ({megabytes(links.screen.size)})
            </a>
          </div>
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
