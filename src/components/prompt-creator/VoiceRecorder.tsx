"use client"

import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Loader2, Mic, Square } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { PROMPT_CREATOR_ENDPOINT, PROMPT_CREATOR_MESSAGES, VOICE_MAX_SECONDS } from "@/constants/promptCreator"

type RecorderState = "idle" | "recording" | "transcribing"

// Ordered by how well the models read them back; the browser picks the first one it can record
const AUDIO_TYPES = ["audio/ogg;codecs=opus", "audio/mp4", "audio/webm;codecs=opus", "audio/webm"]

const pickAudioType = (): string | undefined =>
  typeof MediaRecorder === "undefined" ? undefined : AUDIO_TYPES.find((type) => MediaRecorder.isTypeSupported(type))

const canRecord = () =>
  typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia) && typeof MediaRecorder !== "undefined"

// Recording support never changes while the page is open, so there is nothing to subscribe to
const subscribeToNothing = () => () => undefined

const formatSeconds = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`

interface VoiceRecorderProps {
  // Receives the spoken words once the recording has been written out
  onTranscript: (text: string) => void
  onError: (message: string | null) => void
  disabled?: boolean
}

/**
 * Speak the task instead of typing it: records from the microphone, sends the recording to
 * /api/prompt-creator/transcribe and hands the text back. The recording stops itself at
 * VOICE_MAX_SECONDS, and the microphone is always released, including when the page changes.
 */
export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onTranscript, onError, disabled = false }) => {
  const [state, setState] = useState<RecorderState>("idle")
  const [seconds, setSeconds] = useState(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  // MediaRecorder only exists in the browser, so the server renders the button and the
  // browser decides: it disappears on hydration where recording is not possible
  const isSupported = useSyncExternalStore(subscribeToNothing, canRecord, () => true)

  const releaseMicrophone = useCallback(() => {
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
    recorderRef.current = null
  }, [])

  useEffect(() => () => releaseMicrophone(), [releaseMicrophone])

  // The elapsed time, which also stops a recording that runs too long
  useEffect(() => {
    if (state !== "recording") return
    const timer = setInterval(() => setSeconds((current) => current + 1), 1000)
    return () => clearInterval(timer)
  }, [state])

  useEffect(() => {
    if (state === "recording" && seconds >= VOICE_MAX_SECONDS) recorderRef.current?.stop()
  }, [seconds, state])

  const transcribe = useCallback(
    async (audio: Blob) => {
      if (audio.size === 0) {
        setState("idle")
        onError(PROMPT_CREATOR_MESSAGES.emptyRecording)
        return
      }
      setState("transcribing")
      const form = new FormData()
      form.append("audio", audio, "recording")
      try {
        // Reading a recording saves nothing, so a dropped upload is safe to send again
        const { data } = await requestApi<{ text: string }>(
          `${PROMPT_CREATOR_ENDPOINT}/transcribe`,
          { method: "POST", body: form },
          { retry: true }
        )
        onTranscript(data.text)
        onError(null)
      } catch (error: unknown) {
        const message = error instanceof Error && !(error instanceof TypeError) ? error.message : ""
        onError(message || PROMPT_CREATOR_MESSAGES.transcriptionFailed)
      } finally {
        setState("idle")
      }
    },
    [onError, onTranscript]
  )

  const start = async () => {
    if (!canRecord()) {
      onError(PROMPT_CREATOR_MESSAGES.micUnavailable)
      return
    }
    onError(null)
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
        void transcribe(audio)
      }
      recorder.onerror = () => {
        releaseMicrophone()
        setState("idle")
        onError(PROMPT_CREATOR_MESSAGES.recordingFailed)
      }
      recorderRef.current = recorder
      setSeconds(0)
      recorder.start()
      setState("recording")
    } catch (error: unknown) {
      releaseMicrophone()
      setState("idle")
      const denied = error instanceof DOMException && ["NotAllowedError", "SecurityError"].includes(error.name)
      onError(denied ? PROMPT_CREATOR_MESSAGES.micDenied : PROMPT_CREATOR_MESSAGES.recordingFailed)
    }
  }

  const stop = () => recorderRef.current?.stop()

  if (!isSupported) return null

  const isRecording = state === "recording"
  const isTranscribing = state === "transcribing"

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={disabled || isTranscribing}
        aria-label={isRecording ? "Stop recording and use what you said" : "Describe the task by speaking"}
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
        {isTranscribing ? "Writing it out..." : isRecording ? `Stop (${formatSeconds(seconds)})` : "Speak instead"}
      </button>
      {isRecording && (
        <span className="flex items-center gap-1.5 text-[11px] text-on-surface-variant" role="status">
          <span className="h-2 w-2 animate-pulse rounded-full bg-error" aria-hidden="true" />
          Recording, say what you want done
        </span>
      )}
    </div>
  )
}
