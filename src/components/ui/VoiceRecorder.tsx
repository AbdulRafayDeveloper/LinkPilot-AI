"use client"

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Loader2, Mic, RotateCcw, Square } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { splitRecording } from "@/lib/voiceParts"
import {
  TRANSCRIBE_ENDPOINT,
  VOICE_MAX_SECONDS,
  VOICE_MESSAGES,
  VOICE_PART_CONCURRENCY,
  VOICE_WARN_SECONDS,
  type TranscriptionProvider,
} from "@/constants/voiceInput"
import type { VoiceModuleId } from "@/constants/modelPriority"

type RecorderState = "idle" | "recording" | "transcribing" | "failed"

// Ordered by how well the models read them back; the browser picks the first one it can record
const AUDIO_TYPES = ["audio/ogg;codecs=opus", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"]

const pickAudioType = (): string | undefined =>
  typeof MediaRecorder === "undefined" ? undefined : AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type))

const canRecord = () =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined"

// Recording support never changes while the page is open, so there is nothing to subscribe to
const subscribeToNothing = () => () => undefined

const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

// A recording cut into parts, with each part's text, and who wrote it out, once it has been written out
interface KeptRecording {
  parts: Blob[]
  texts: (string | null)[]
  providers: (TranscriptionProvider | null)[]
}

type PartResult = { text: string; provider: TranscriptionProvider | null } | { error: string }

async function writeOutPart(part: Blob, transcribeFor: VoiceModuleId | undefined): Promise<PartResult> {
  const form = new FormData()
  form.append("audio", part, "recording")
  if (transcribeFor) form.append("for", transcribeFor)
  try {
    // Reading a recording saves nothing, so a dropped upload is safe to send again
    const { data } = await requestApi<{ text: string; provider: TranscriptionProvider }>(TRANSCRIBE_ENDPOINT, { method: "POST", body: form }, { retry: true })
    return { text: data.text, provider: data.provider ?? null }
  } catch (error: unknown) {
    const message = error instanceof Error && !(error instanceof TypeError) ? error.message : ""
    // A part that is only a pause has nothing to write out, which is not a failure
    if (message === VOICE_MESSAGES.unclearAudio) return { text: "", provider: null }
    return { error: message || VOICE_MESSAGES.transcriptionFailed }
  }
}

interface VoiceRecorderProps {
  // Receives the spoken words once the whole recording has been written out, with every provider that wrote a part of it
  onTranscript: (text: string, providers: TranscriptionProvider[]) => void
  onError: (message: string | null) => void
  disabled?: boolean
  /** What speaking fills in on this page, for the button and the screen reader label */
  what?: string
  /** The module recording, so the speech is read in that module's provider order (constants/modelPriority.ts) */
  transcribeFor?: VoiceModuleId
}

/**
 * Speak instead of typing: records from the microphone for up to VOICE_MAX_SECONDS, cuts a long
 * recording into parts (lib/voiceParts.ts), writes each part out through /api/transcribe and hands
 * the joined text back. A part that fails leaves the recording kept, so Try again sends only the
 * parts still missing and nobody has to speak for six minutes twice. The microphone is always
 * released, including when the page changes.
 */
export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onTranscript,
  onError,
  disabled = false,
  what = "what you want done",
  transcribeFor,
}) => {
  const [state, setState] = useState<RecorderState>("idle")
  const [seconds, setSeconds] = useState(0)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [stoppedAtLimit, setStoppedAtLimit] = useState(false)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const keptRef = useRef<KeptRecording | null>(null)
  // MediaRecorder only exists in the browser, so the server renders the button and the
  // browser decides: it disappears on hydration where recording is not possible
  const isSupported = useSyncExternalStore(subscribeToNothing, canRecord, () => true)

  const releaseMicrophone = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
  }, [])

  useEffect(() => () => releaseMicrophone(), [releaseMicrophone])

  // The elapsed time, which also stops a recording that reaches the limit
  useEffect(() => {
    if (state !== "recording") return
    const timer = setInterval(() => setSeconds((current) => current + 1), 1000)
    return () => clearInterval(timer)
  }, [state])

  useEffect(() => {
    if (state === "recording" && seconds >= VOICE_MAX_SECONDS && recorderRef.current?.state === "recording") {
      setStoppedAtLimit(true)
      recorderRef.current.stop()
    }
  }, [seconds, state])

  // Writes out every part that has no text yet, a few at a time, keeping their order
  const writeOut = useCallback(async () => {
    const kept = keptRef.current
    if (!kept) return
    const queue = kept.texts.flatMap((text, index) => (text === null ? [index] : []))
    let done = kept.texts.length - queue.length
    let firstError: string | null = null
    setState("transcribing")
    setProgress({ done, total: kept.parts.length })

    const worker = async () => {
      for (let index = queue.shift(); index !== undefined; index = queue.shift()) {
        const result = await writeOutPart(kept.parts[index], transcribeFor)
        if ("text" in result) {
          kept.texts[index] = result.text
          kept.providers[index] = result.provider
          done += 1
          setProgress({ done, total: kept.parts.length })
        } else {
          firstError ??= result.error
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(VOICE_PART_CONCURRENCY, queue.length) }, worker))

    const failed = kept.texts.filter((text) => text === null).length
    if (failed > 0) {
      setState("failed")
      onError(kept.parts.length === 1 ? firstError : VOICE_MESSAGES.partsFailed(failed, kept.parts.length))
      return
    }

    keptRef.current = null
    setState("idle")
    setProgress(null)
    setStoppedAtLimit(false)
    const text = kept.texts.join(" ").replace(/ {2,}/g, " ").trim()
    if (!text) {
      onError(VOICE_MESSAGES.unclearAudio)
      return
    }
    onError(null)
    // Each provider once, in the order the parts were written out
    const providers = [...new Set(kept.providers.filter((provider): provider is TranscriptionProvider => provider !== null))]
    onTranscript(text, providers)
  }, [onError, onTranscript, transcribeFor])

  const finishRecording = useCallback(
    async (audio: Blob) => {
      if (audio.size === 0) {
        setState("idle")
        onError(VOICE_MESSAGES.emptyRecording)
        return
      }
      setState("transcribing")
      setProgress(null)
      try {
        const parts = await splitRecording(audio)
        keptRef.current = { parts, texts: parts.map(() => null), providers: parts.map(() => null) }
      } catch {
        setState("idle")
        onError(VOICE_MESSAGES.audioTooLarge)
        return
      }
      await writeOut()
    },
    [onError, writeOut]
  )

  const start = async () => {
    if (!canRecord()) {
      onError(VOICE_MESSAGES.micUnavailable)
      return
    }
    onError(null)
    // A new recording replaces one that was kept for another try
    keptRef.current = null
    setStoppedAtLimit(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = pickAudioType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const audio = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" })
        chunksRef.current = []
        releaseMicrophone()
        void finishRecording(audio)
      }
      recorder.onerror = () => {
        releaseMicrophone()
        setState("idle")
        onError(VOICE_MESSAGES.recordingFailed)
      }
      recorderRef.current = recorder
      setSeconds(0)
      recorder.start()
      setState("recording")
    } catch (error: unknown) {
      releaseMicrophone()
      setState("idle")
      const denied = error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name)
      onError(denied ? VOICE_MESSAGES.micDenied : VOICE_MESSAGES.recordingFailed)
    }
  }

  const stop = () => recorderRef.current?.stop()

  if (!isSupported) return null

  const isRecording = state === "recording"
  const isTranscribing = state === "transcribing"
  const secondsLeft = VOICE_MAX_SECONDS - seconds
  const isNearLimit = isRecording && secondsLeft <= VOICE_WARN_SECONDS
  const writingLabel =
    progress && progress.total > 1 ? `Writing it out (${Math.min(progress.done + 1, progress.total)} of ${progress.total})...` : "Writing it out..."

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {isRecording && (
        <span
          className={`flex items-center gap-1.5 text-[11px] ${isNearLimit ? "font-semibold text-error" : "text-on-surface-variant"}`}
          role="status"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-error" aria-hidden="true" />
          {isNearLimit ? `${secondsLeft}s left, it stops at ${formatSeconds(VOICE_MAX_SECONDS)}` : `Recording, say ${what}`}
        </span>
      )}
      {isTranscribing && stoppedAtLimit && (
        <span className="text-[11px] text-on-surface-variant" role="status">
          {VOICE_MESSAGES.stoppedAtLimit}
        </span>
      )}
      {state === "idle" && <span className="text-[11px] text-outline">{VOICE_MESSAGES.limit}</span>}
      {state === "failed" && (
        <button
          type="button"
          onClick={() => void writeOut()}
          disabled={disabled}
          className="inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary-fixed/40 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary-fixed disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Try again
        </button>
      )}
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={disabled || isTranscribing}
        aria-label={isRecording ? "Stop recording and use what you said" : `Say ${what} instead of typing it, up to ${VOICE_MAX_SECONDS / 60} minutes`}
        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
          isRecording
            ? "border-error bg-error-container text-error"
            : "border-outline-variant bg-white text-on-surface hover:border-primary/40 hover:text-primary"
        }`}
      >
        {isTranscribing ? (
          <Loader2 size={15} className="animate-spin" aria-hidden="true" />
        ) : isRecording ? (
          <Square size={15} aria-hidden="true" />
        ) : (
          <Mic size={15} aria-hidden="true" />
        )}
        {isTranscribing
          ? writingLabel
          : isRecording
            ? `Stop (${formatSeconds(seconds)} / ${formatSeconds(VOICE_MAX_SECONDS)})`
            : state === "failed"
              ? "Record again"
              : "Speak instead"}
      </button>
    </div>
  )
}
