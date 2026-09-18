"use client"

import React, { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, Circle, CloudUpload, Headphones, Laptop, Loader2, Mic, MonitorUp, Pause, Play, Square, Video, WifiOff } from "lucide-react"
import { Sidebar } from "@/components/ui/Sidebar"
import { Header } from "@/components/ui/Header"
import { useSidebarCollapse } from "@/hooks/useSidebarCollapse"
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder"
import { HEARD_LEVELS_SHOWN, meetingRecorder } from "@/lib/meetingRecorder"
import { MEETING_TITLE_MAX_LENGTH } from "@/constants/meetings"
import {
  DEFAULT_SOUND_MODE,
  RECORDING_CHUNK_MAX_BYTES,
  RECORDING_MESSAGES,
  RECORDING_SOUND_MODES,
  type RecordingSoundMode,
} from "@/constants/meetingRecording"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"

const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} MB`

const clock = (ms: number) => {
  const total = Math.floor(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = String(Math.floor((total % 3600) / 60)).padStart(2, "0")
  const seconds = String(total % 60).padStart(2, "0")
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`
}

const toggleClass =
  "flex items-start gap-3 rounded-xl border border-outline-variant bg-white p-3 text-left transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-primary/5"

/**
 * How loud one side of the meeting is, live. Filled when there is sound, and saying so in words too,
 * so whether the other people are coming through never rests on colour alone.
 */
const SoundMeter: React.FC<{ label: string; icon: React.ElementType; level: number; heardAt: number }> = ({ label, icon: Icon, level, heardAt }) => {
  const isHeard = level >= heardAt
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5">
      <div className="flex items-center justify-between gap-2 text-[12px]">
        <span className="flex items-center gap-1.5 font-semibold text-on-surface">
          <Icon size={14} className="text-primary" aria-hidden="true" />
          {label}
        </span>
        <span className={isHeard ? "font-semibold text-success" : "text-outline"}>{isHeard ? "Hearing sound" : "Quiet"}</span>
      </div>
      <div
        role="meter"
        aria-label={`${label}, sound level`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(level * 100)}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-300 ${isHeard ? "bg-success" : "bg-outline/50"}`}
          style={{ width: `${Math.round(level * 100)}%` }}
        />
      </div>
    </div>
  )
}

/**
 * Record a meeting: share the call's tab or screen with its sound, speak into the microphone, and the
 * app uploads it in chunks while it records. Stopping waits for the last chunk, then opens the meeting,
 * where the recording is joined, written out and turned into notes.
 */
export default function RecordMeetingClient() {
  const router = useRouter()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { isCollapsed, toggleCollapsed } = useSidebarCollapse()
  const recorder = useMeetingRecorder()
  const [title, setTitle] = useState("")
  const [withMicrophone, setWithMicrophone] = useState(true)
  const [withCamera, setWithCamera] = useState(false)
  const [sound, setSound] = useState<RecordingSoundMode>(DEFAULT_SOUND_MODE)
  // Recording only your voice, the microphone is the recording, so it can't be switched off
  const onlyVoice = sound === "voice"
  const previewRef = useRef<HTMLVideoElement>(null)

  // The shared screen, small, so it is clear what is being recorded
  useEffect(() => {
    if (previewRef.current) previewRef.current.srcObject = recorder.preview
  }, [recorder.preview])

  // Once every chunk has landed the meeting takes over: joining, writing out and the notes happen there
  useEffect(() => {
    if (recorder.status !== "done" || !recorder.meetingId) return
    const meetingId = recorder.meetingId
    router.push(`/meetings/${meetingId}`)
    meetingRecorder.reset()
  }, [recorder.status, recorder.meetingId, router])

  const isLive = recorder.status === "recording" || recorder.status === "paused"
  const isClosing = recorder.status === "stopping" || recorder.status === "finishing"
  const percent = recorder.recordedBytes > 0 ? Math.min(100, Math.round((recorder.uploadedBytes / recorder.recordedBytes) * 100)) : 0

  return (
    <div className="font-body-md text-body-md flex h-screen min-h-screen overflow-hidden bg-background text-on-surface">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} isCollapsed={isCollapsed} />

      <div className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setIsSidebarOpen(true)} isSidebarCollapsed={isCollapsed} onToggleCollapse={toggleCollapsed} />

        <main className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
          <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 md:p-6 lg:p-8">
            <Link href="/meetings" className="inline-flex w-fit items-center gap-1.5 text-[12px] font-semibold text-outline transition-colors hover:text-primary">
              <ArrowLeft size={14} aria-hidden="true" />
              All meetings
            </Link>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-on-surface">
                <Video size={24} className="shrink-0 text-primary" aria-hidden="true" />
                Record a meeting
              </h1>
              <p className="mt-1 text-sm text-on-surface-variant">
                Record a meeting, a WhatsApp call, a video, or just yourself: your voice and whatever the laptop plays. It uploads while it
                records; when you stop, it is written out and turned into notes, and it gets a name you can change.
              </p>
            </div>

            {(recorder.status === "idle" || recorder.status === "error") && (
              <section className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
                {recorder.error && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl border border-error/40 bg-error-container px-3 py-2 text-[12px] text-error">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                      {recorder.error}
                      {recorder.meetingId && (
                        <>
                          {" "}
                          <Link href={`/meetings/${recorder.meetingId}`} className="font-semibold underline">
                            Open the meeting
                          </Link>
                        </>
                      )}
                    </span>
                  </p>
                )}
                <label className="flex flex-col gap-1 text-[10px] font-bold uppercase tracking-wider text-outline">
                  Meeting name (optional)
                  <input
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    maxLength={MEETING_TITLE_MAX_LENGTH}
                    placeholder="Left empty, one is written from what was said"
                    className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2.5 text-sm font-normal normal-case tracking-normal text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
                  />
                </label>
                <RadioCardGroup
                  name="recording-sound"
                  legend="What are you recording?"
                  options={RECORDING_SOUND_MODES}
                  value={sound}
                  onChange={setSound}
                  wrapLabels
                />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <label className={toggleClass}>
                    <input
                      type="checkbox"
                      checked={onlyVoice || withMicrophone}
                      onChange={(event) => setWithMicrophone(event.target.checked)}
                      disabled={onlyVoice}
                      className="mt-1 h-4 w-4 accent-primary disabled:opacity-60"
                    />
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                        <Mic size={15} aria-hidden="true" />
                        My microphone
                      </span>
                      <span className="text-[12px] text-on-surface-variant">
                        {onlyVoice ? "Always on: your voice is the recording." : "Your own voice, mixed with the laptop's sound."}
                      </span>
                    </span>
                  </label>
                  <label className={toggleClass}>
                    <input type="checkbox" checked={withCamera} onChange={(event) => setWithCamera(event.target.checked)} className="mt-1 h-4 w-4 accent-primary" />
                    <span className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-on-surface">
                        <Camera size={15} aria-hidden="true" />
                        My camera
                      </span>
                      <span className="text-[12px] text-on-surface-variant">Recorded alongside the screen, shown in a corner when you play it back.</span>
                    </span>
                  </label>
                </div>
                {/* What the laptop plays is only heard through what is shared, so the choice in the next step
                    decides whether it is recorded. A share without sound is refused before anything starts */}
                {onlyVoice ? (
                  <p className="flex items-start gap-2 rounded-xl bg-surface-container-lowest px-3 py-2.5 text-[12px] text-on-surface-variant">
                    <MonitorUp size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                    In the next step pick any screen, window or tab to show. Only your microphone is recorded, so no sound option is needed.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2 rounded-xl bg-surface-container-lowest px-3 py-2.5 text-[12px] text-on-surface-variant">
                    <p className="flex items-center gap-1.5 font-semibold text-on-surface">
                      <MonitorUp size={14} className="shrink-0 text-primary" aria-hidden="true" />
                      So the laptop&apos;s sound is recorded, in the next step:
                    </p>
                    <ul className="flex flex-col gap-1.5 pl-5">
                      <li className="list-disc">
                        <span className="font-semibold text-on-surface">Anything that plays on the laptop</span> (a WhatsApp call, the Zoom or Teams app,
                        YouTube, any tab): pick <span className="font-semibold text-on-surface">Entire screen</span> and switch on{" "}
                        <span className="font-semibold text-on-surface">&ldquo;Also share system audio&rdquo;</span>. This catches every sound the laptop makes.
                      </li>
                      <li className="list-disc">
                        <span className="font-semibold text-on-surface">Just one browser tab</span> (Google Meet, YouTube, WhatsApp Web): pick that{" "}
                        <span className="font-semibold text-on-surface">tab</span> and keep{" "}
                        <span className="font-semibold text-on-surface">&ldquo;Also share tab audio&rdquo;</span> on.
                      </li>
                      <li className="list-disc">
                        Don&apos;t pick a <span className="font-semibold text-on-surface">window</span>: a window carries no sound, so it is refused.
                      </li>
                    </ul>
                    <p className="flex items-start gap-1.5">
                      <Headphones size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                      Wear headphones if you can, so the laptop&apos;s sound isn&apos;t also picked up a second time through your microphone.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void meetingRecorder.start({ title, withMicrophone, withCamera, sound })}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant"
                >
                  <Circle size={14} className="fill-current" aria-hidden="true" />
                  Start recording
                </button>
              </section>
            )}

            {recorder.status === "starting" && (
              <p role="status" className="flex items-center gap-2 rounded-2xl border border-outline-variant bg-white p-5 text-sm text-on-surface-variant shadow-sm">
                <Loader2 size={16} className="animate-spin text-primary" aria-hidden="true" />
                Choose what to share, then the recording starts...
              </p>
            )}

            {(isLive || isClosing) && (
              <section className="flex flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm" aria-live="polite">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-on-surface">
                    {recorder.status === "recording" ? (
                      <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-error" aria-hidden="true" />
                    ) : recorder.status === "paused" ? (
                      <Pause size={14} className="text-secondary" aria-hidden="true" />
                    ) : (
                      <Loader2 size={14} className="animate-spin text-primary" aria-hidden="true" />
                    )}
                    {recorder.status === "recording" ? "Recording" : recorder.status === "paused" ? "Paused" : "Finishing the upload"}
                    <span className="font-code text-lg tabular-nums text-on-surface">{clock(recorder.elapsedMs)}</span>
                  </p>
                  {isLive && (
                    <div className="flex flex-wrap gap-2">
                      {recorder.status === "recording" ? (
                        <button
                          type="button"
                          onClick={() => meetingRecorder.pause()}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                        >
                          <Pause size={16} aria-hidden="true" />
                          Pause
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => meetingRecorder.resume()}
                          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-high"
                        >
                          <Play size={16} aria-hidden="true" />
                          Resume
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void meetingRecorder.stop()}
                        className="inline-flex items-center gap-2 rounded-xl bg-error px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-error/90"
                      >
                        <Square size={14} className="fill-current" aria-hidden="true" />
                        Stop
                      </button>
                    </div>
                  )}
                </div>

                {recorder.preview && (
                  <video ref={previewRef} autoPlay muted playsInline className="aspect-video w-full rounded-xl border border-outline-variant bg-on-surface/90 object-contain" />
                )}

                <div className="flex flex-col gap-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[12px]">
                    <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                      <CloudUpload size={14} className="text-primary" aria-hidden="true" />
                      Uploaded {megabytes(recorder.uploadedBytes)} of {megabytes(recorder.recordedBytes)}
                    </span>
                    <span className="tabular-nums text-on-surface-variant">
                      {percent}% · {recorder.chunksUploaded} chunks up{recorder.chunksWaiting > 0 ? `, ${recorder.chunksWaiting} on the way` : ""}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Upload progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                    className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
                  >
                    <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
                  </div>
                  <p className="text-[11px] text-outline">
                    Sent in chunks of up to {megabytes(RECORDING_CHUNK_MAX_BYTES)} while it records
                    {recorder.uploadsPaused ? ". Uploads are paused with the recording." : "."}
                  </p>
                </div>

                {recorder.status === "recording" && (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {recorder.hasMeetingSound && <SoundMeter label="Laptop sound" icon={Laptop} level={recorder.levels.meeting} heardAt={HEARD_LEVELS_SHOWN.laptop} />}
                    {recorder.hasMicrophone && <SoundMeter label="Your voice" icon={Mic} level={recorder.levels.mic} heardAt={HEARD_LEVELS_SHOWN.voice} />}
                  </div>
                )}
                {recorder.meetingSilent && (
                  <p role="alert" className="flex items-start gap-2 rounded-xl border border-secondary-fixed-dim bg-secondary-fixed/40 px-3 py-2 text-[12px] text-on-secondary-fixed-variant">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    {RECORDING_MESSAGES.meetingSilent}
                  </p>
                )}

                <ul className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
                  <li className="rounded-full bg-surface-container-high px-2 py-0.5 text-on-surface-variant">Screen</li>
                  {recorder.hasMeetingSound && <li className="rounded-full bg-surface-container-high px-2 py-0.5 text-on-surface-variant">Meeting sound</li>}
                  {recorder.hasMicrophone && <li className="rounded-full bg-surface-container-high px-2 py-0.5 text-on-surface-variant">Microphone</li>}
                  {recorder.hasCamera && <li className="rounded-full bg-surface-container-high px-2 py-0.5 text-on-surface-variant">Camera</li>}
                </ul>

                {recorder.retrying && (
                  <p role="status" className="flex items-start gap-2 rounded-xl border border-secondary-fixed-dim bg-secondary-fixed/40 px-3 py-2 text-[12px] text-on-secondary-fixed-variant">
                    <WifiOff size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
                    The connection dropped. Chunks are uploaded again as soon as it&apos;s back; nothing recorded is lost.
                  </p>
                )}
                {recorder.notices
                  .filter((notice) => !notice.startsWith("The connection dropped"))
                  .map((notice) => (
                    <p key={notice} className="flex items-start gap-2 rounded-xl bg-surface-container-lowest px-3 py-2 text-[12px] text-on-surface-variant">
                      <AlertTriangle size={14} className="mt-0.5 shrink-0 text-secondary" aria-hidden="true" />
                      {notice}
                    </p>
                  ))}
                {isClosing && (
                  <p className="flex items-center gap-2 text-[12px] text-on-surface-variant">
                    <CheckCircle2 size={14} className="text-success" aria-hidden="true" />
                    Recording stopped. Keep this page open until the last chunk is up; the meeting opens by itself.
                  </p>
                )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
