"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { Loader2, Mic, Play, Square, Trash2 } from "lucide-react"
import { requestApi } from "@/lib/apiClient"
import { PROJECT_TASK_MESSAGES, PROJECT_VOICE_ENDPOINT, VOICE_NOTE_MAX_SECONDS } from "@/constants/clientProjectTasks"
import { VOICE_MESSAGES } from "@/constants/voiceInput"
import type { VoiceNoteView } from "@/types/clientProjectTasks"

interface VoiceNoteFieldProps {
  note: VoiceNoteView | null
  onChange: (note: VoiceNoteView | null) => void
  onError: (message: string | null) => void
  disabled?: boolean
  // Off when file storage isn't set up: the button says why instead of failing when it is pressed
  canRecord?: boolean
  /**
   * Where the recording is sent, for a page whose reader has no account: a client project's shared
   * link stores it through its own token's route, which answers in the same shape. Left out
   * everywhere else, which uses the signed-in one.
   */
  endpoint?: string
}

/** The clock while recording, and the length of a note that is already there. */
export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`

/**
 * One voice note on a task: record it, hear it back, or take it off.
 *
 * It records with the browser's own MediaRecorder and sends the bytes to the app, which stores them
 * and answers what to save on the task. It is not the shared `VoiceRecorder`, which exists to turn
 * speech into text through a model: nothing here is transcribed, nothing is sent to a provider, and
 * what is kept is the recording itself. The clock stops it at the shared six-minute limit, so a
 * recording the server would refuse is never made.
 */
export const VoiceNoteField: React.FC<VoiceNoteFieldProps> = ({ note, onChange, onError, disabled, canRecord = true, endpoint = PROJECT_VOICE_ENDPOINT }) => {
  const [isRecording, setIsRecording] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [seconds, setSeconds] = useState(0)
  const recorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const startedAt = useRef(0)
  const timer = useRef<number | null>(null)

  const stopClock = () => {
    if (timer.current !== null) window.clearInterval(timer.current)
    timer.current = null
  }

  // A recording still running when the page goes must not hold the microphone open
  useEffect(
    () => () => {
      stopClock()
      recorder.current?.stream.getTracks().forEach((track) => track.stop())
    },
    []
  )

  const save = useCallback(
    async (blob: Blob, length: number) => {
      setIsSaving(true)
      try {
        const { data } = await requestApi<VoiceNoteView>(
          `${endpoint}?seconds=${Math.round(length)}`,
          { method: "POST", headers: { "Content-Type": blob.type || "audio/webm" }, body: blob },
          // Storing a recording saves no record, so a repeat only leaves a copy nothing points at
          { retry: true }
        )
        onChange(data)
        onError(null)
      } catch (reason: unknown) {
        onError(reason instanceof Error ? reason.message : PROJECT_TASK_MESSAGES.voiceFailed)
      } finally {
        setIsSaving(false)
      }
    },
    [onChange, onError, endpoint]
  )

  const stop = useCallback(() => {
    stopClock()
    setIsRecording(false)
    if (recorder.current?.state === "recording") recorder.current.stop()
  }, [])

  const start = async () => {
    if (disabled || isRecording || isSaving) return
    onError(null)
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      onError(VOICE_MESSAGES.micUnavailable)
      return
    }
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      onError(VOICE_MESSAGES.micDenied)
      return
    }
    try {
      const media = new MediaRecorder(stream)
      recorder.current = media
      chunks.current = []
      media.ondataavailable = (event) => event.data.size > 0 && chunks.current.push(event.data)
      media.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const length = (Date.now() - startedAt.current) / 1000
        const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" })
        if (blob.size === 0) {
          onError(VOICE_MESSAGES.emptyRecording)
          return
        }
        void save(blob, length)
      }
      startedAt.current = Date.now()
      setSeconds(0)
      media.start()
      setIsRecording(true)
      timer.current = window.setInterval(() => {
        const running = (Date.now() - startedAt.current) / 1000
        setSeconds(running)
        // It stops itself at the limit, so a recording too large to store is never made
        if (running >= VOICE_NOTE_MAX_SECONDS) stop()
      }, 250)
    } catch {
      stream.getTracks().forEach((track) => track.stop())
      onError(VOICE_MESSAGES.recordingFailed)
    }
  }

  const buttonClass =
    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-outline-variant bg-white px-3 py-1.5 text-[12px] font-semibold text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-50"

  if (note) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-2">
        <Play size={14} className="shrink-0 text-primary" aria-hidden="true" />
        <audio src={note.url} controls className="h-9 min-w-0 flex-1" aria-label="The voice note on this task" />
        <span className="text-[11px] text-outline">{clock(note.seconds)}</span>
        <button type="button" onClick={() => onChange(null)} disabled={disabled} aria-label="Remove the voice note" className={`${buttonClass} hover:text-error`}>
          <Trash2 size={13} aria-hidden="true" />
          Remove
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={isRecording ? stop : start}
        disabled={disabled || isSaving || !canRecord}
        title={canRecord ? undefined : PROJECT_TASK_MESSAGES.voiceStorageUnavailable}
        className={`${buttonClass} ${isRecording ? "border-error/40 bg-error-container text-error" : ""}`}
      >
        {isSaving ? (
          <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        ) : isRecording ? (
          <Square size={13} aria-hidden="true" />
        ) : (
          <Mic size={14} aria-hidden="true" />
        )}
        {isSaving ? "Saving..." : isRecording ? `Stop (${clock(seconds)} / ${clock(VOICE_NOTE_MAX_SECONDS)})` : "Record a voice note"}
      </button>
      <span className="text-[11px] text-outline">{canRecord ? `Up to ${clock(VOICE_NOTE_MAX_SECONDS)}` : PROJECT_TASK_MESSAGES.voiceStorageUnavailable}</span>
    </div>
  )
}
