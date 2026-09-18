"use client"

import React, { useCallback, useEffect, useRef, useState } from "react"
import { AudioLines, ClipboardPaste, Loader2, Play, Trash2, Upload } from "lucide-react"
import { CLIENT_VOICES_MESSAGES, VOICE_BATCH_MAX, VOICE_MAX_LABEL } from "@/constants/clientVoices"
import type { VoiceEntry, VoiceSource } from "@/types/clientVoices"

interface VoiceInputPanelProps {
  voices: VoiceEntry[]
  isProcessing: boolean
  onAdd: (files: File[], source: VoiceSource) => void
  onRemove: (id: string) => void
  onProcess: () => void
  onReject: (message: string) => void
}

const formatSize = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`)

const statusLabel: Record<VoiceEntry["status"], string> = {
  ready: "Ready",
  queued: "Waiting",
  transcribing: "Writing it out...",
  done: "Done",
  failed: "Failed",
}

const statusClass: Record<VoiceEntry["status"], string> = {
  ready: "bg-surface-container-high text-on-surface-variant",
  queued: "bg-surface-container-high text-on-surface-variant",
  transcribing: "bg-primary-container text-on-primary-container",
  done: "bg-primary/10 text-primary",
  failed: "bg-error-container text-error",
}

/**
 * Where the voices come in. A voice message can be pasted straight from the clipboard, dropped
 * on the page, or picked from the file browser, and each one shows up in the list before
 * anything is sent, so the batch is what the user can see.
 *
 * Pasting only works when the app the voice was copied from actually puts audio on the
 * clipboard. Plenty of them copy a link instead, and when that happens the panel says so and
 * points at dropping the file rather than pretending a voice arrived.
 */
export const VoiceInputPanel: React.FC<VoiceInputPanelProps> = ({
  voices,
  isProcessing,
  onAdd,
  onRemove,
  onProcess,
  onReject,
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [isReadingClipboard, setIsReadingClipboard] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const isFull = voices.length >= VOICE_BATCH_MAX
  const canProcess = voices.length > 0 && !isProcessing

  const take = useCallback(
    (files: File[], source: VoiceSource) => {
      if (files.length === 0) return
      onAdd(files, source)
    },
    [onAdd]
  )

  // A voice pasted anywhere on the page joins the batch, which is the point of the module
  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isProcessing) return
      const files = Array.from(event.clipboardData?.files ?? [])
      const items = Array.from(event.clipboardData?.items ?? [])
      const fromItems = items
        .filter((item) => item.kind === "file" && item.type.startsWith("audio/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null)
      const audio = [...files, ...fromItems].filter(
        (file, index, all) => all.findIndex((other) => other.name === file.name && other.size === file.size) === index
      )
      if (audio.length === 0) {
        // Only complain when something was actually pasted into this page
        if (event.clipboardData && event.clipboardData.types.length > 0 && !event.clipboardData.types.includes("text/plain")) {
          onReject(CLIENT_VOICES_MESSAGES.nothingPasted)
        }
        return
      }
      event.preventDefault()
      take(audio, "paste")
    }
    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [isProcessing, onReject, take])

  /** The button version of the same thing, for browsers that allow reading the clipboard. */
  const readClipboard = async () => {
    if (isProcessing || isReadingClipboard) return
    setIsReadingClipboard(true)
    try {
      if (!navigator.clipboard?.read) {
        onReject(CLIENT_VOICES_MESSAGES.clipboardBlocked)
        return
      }
      const items = await navigator.clipboard.read()
      const files: File[] = []
      for (const item of items) {
        const audioType = item.types.find((type) => type.startsWith("audio/"))
        if (!audioType) continue
        const blob = await item.getType(audioType)
        files.push(new File([blob], `pasted-voice-${files.length + 1}.${audioType.split("/")[1]?.split(";")[0] || "ogg"}`, { type: audioType }))
      }
      if (files.length === 0) {
        onReject(CLIENT_VOICES_MESSAGES.nothingPasted)
        return
      }
      take(files, "paste")
    } catch {
      // Reading the clipboard is refused in plenty of browsers, and that is not an error to hide
      onReject(CLIENT_VOICES_MESSAGES.clipboardBlocked)
    } finally {
      setIsReadingClipboard(false)
    }
  }

  return (
    <section className="flex min-h-0 flex-col gap-4 rounded-2xl border border-outline-variant bg-white p-5 shadow-sm">
      <div
        onDragOver={(event) => {
          event.preventDefault()
          if (!isProcessing) setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          if (isProcessing) return
          take(Array.from(event.dataTransfer.files), "drop")
        }}
        className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 border-dashed px-4 py-4 text-center transition-colors ${
          isDragging ? "border-primary bg-primary/5" : "border-outline-variant bg-surface-container-lowest"
        }`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/5 text-primary">
          <AudioLines size={18} aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold text-on-surface">Paste a copied voice message, or drop the files here</p>
        <p className="max-w-sm text-[12px] leading-relaxed text-on-surface-variant">
          Press Ctrl+V anywhere on this page, or use the button. If the app you copied from only copies a link, save the
          voice and drop it here instead. Up to {VOICE_BATCH_MAX} voices, each under {VOICE_MAX_LABEL}.
        </p>
        {/* Pasting is the way most voices arrive, so it is the filled button and sits first */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={readClipboard}
            disabled={isProcessing || isFull || isReadingClipboard}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isReadingClipboard ? (
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            ) : (
              <ClipboardPaste size={14} aria-hidden="true" />
            )}
            Paste voice
          </button>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isProcessing || isFull}
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant bg-white px-3 py-2 text-[12px] font-semibold text-on-surface transition-colors hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={14} aria-hidden="true" />
            Choose files
          </button>
        </div>
        <input
          ref={inputRef}
          id="client-voice-files"
          type="file"
          accept="audio/*,.opus,.oga,.m4a"
          multiple
          className="sr-only"
          aria-label="Choose voice message files"
          onChange={(event) => {
            take(Array.from(event.target.files ?? []), "file")
            event.target.value = ""
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-outline">Voices in this batch</h2>
        <span className={`text-[11px] font-semibold ${isFull ? "text-error" : "text-outline"}`} aria-live="polite">
          {voices.length} / {VOICE_BATCH_MAX}
        </span>
      </div>

      {voices.length === 0 ? (
        <p className="rounded-xl bg-surface-container-lowest px-3 py-6 text-center text-[12px] text-on-surface-variant">
          Nothing added yet.
        </p>
      ) : (
        <ul className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
          {voices.map((voice) => (
            <li
              key={voice.id}
              className="flex items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-[11px] font-bold text-primary">
                {voice.position}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-on-surface">{voice.name}</p>
                <p className="text-[11px] text-outline">
                  {formatSize(voice.size)} · {voice.source === "paste" ? "pasted" : voice.source === "drop" ? "dropped" : "chosen"}
                </p>
              </div>
              <span className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-semibold ${statusClass[voice.status]}`}>
                {statusLabel[voice.status]}
              </span>
              <button
                type="button"
                onClick={() => onRemove(voice.id)}
                disabled={isProcessing}
                aria-label={`Remove voice ${voice.position}`}
                className="shrink-0 rounded-md p-1 text-outline transition-colors hover:bg-error/5 hover:text-error disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onProcess}
        disabled={!canProcess}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-on-primary-fixed-variant disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isProcessing ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        {isProcessing ? "Working through the batch..." : `Transcribe ${voices.length || ""} ${voices.length === 1 ? "voice" : "voices"}`.trim()}
      </button>
    </section>
  )
}
