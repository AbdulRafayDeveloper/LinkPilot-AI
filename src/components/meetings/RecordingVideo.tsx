"use client"

import React, { useEffect, useRef } from "react"
import { Download } from "lucide-react"
import type { MeetingRecordingLinks } from "@/types/meetingRecording"

interface RecordingVideoProps {
  // The screen recording, which is what plays; a recording with only audio has none
  screen: NonNullable<MeetingRecordingLinks["screen"]>
  camera: MeetingRecordingLinks["camera"]
  // Whether to offer the file itself; the shared link offers it too, since watching it is the point
  canDownload?: boolean
}

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`

/**
 * What was recorded, playing: the screen with the camera in a corner, and the file to download.
 *
 * It is one component because **two pages show the same recording** — the meeting page for the
 * owner and the shared link for whoever it was sent to — and keeping the camera in step with the
 * screen is fiddly enough that a second copy of it would drift from this one.
 */
export const RecordingVideo: React.FC<RecordingVideoProps> = ({ screen, camera, canDownload = true }) => {
  const screenRef = useRef<HTMLVideoElement>(null)
  const cameraRef = useRef<HTMLVideoElement>(null)

  // The camera follows the screen: play, pause and seek together, drift corrected as it plays
  useEffect(() => {
    const video = screenRef.current
    const overlay = cameraRef.current
    if (!video || !overlay) return
    const follow = () => {
      if (Math.abs(overlay.currentTime - video.currentTime) > 0.3) overlay.currentTime = video.currentTime
      if (video.paused !== overlay.paused) void (video.paused ? overlay.pause() : overlay.play().catch(() => undefined))
    }
    const events = ["play", "pause", "seeked", "timeupdate"] as const
    events.forEach((name) => video.addEventListener(name, follow))
    return () => events.forEach((name) => video.removeEventListener(name, follow))
  }, [screen.url, camera?.url])

  return (
    // At most 70% of the window's height, so a wide screen doesn't push the summary under the fold
    // while the video still has as much room as it can use
    <div className="mx-auto flex w-full max-w-[min(100%,124vh)] flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl border border-outline-variant bg-on-surface">
        <video ref={screenRef} src={screen.url} controls preload="metadata" className="aspect-video w-full" />
        {camera && (
          <video
            ref={cameraRef}
            src={camera.url}
            muted
            playsInline
            preload="metadata"
            aria-label="Camera"
            className="pointer-events-none absolute bottom-12 right-3 w-1/4 max-w-[220px] rounded-lg border-2 border-white/70 shadow-lg"
          />
        )}
      </div>
      {canDownload && (
        <a
          href={screen.downloadUrl}
          className="inline-flex w-fit items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
        >
          <Download size={13} aria-hidden="true" />
          Download the video ({megabytes(screen.size)})
        </a>
      )}
    </div>
  )
}
