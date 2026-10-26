"use client"

import React, { useCallback, useState } from "react"
import { AlertTriangle, ChevronDown, Languages, Loader2, RotateCcw } from "lucide-react"
import { VoiceRecorder } from "@/components/ui/VoiceRecorder"
import { CopyButton } from "@/components/ui/CopyButton"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"
import { requestApi } from "@/lib/apiClient"
import { createToolStore, useToolStore } from "@/lib/toolStore"
import { describeProviders } from "@/constants/aiProviders"
import { QUICK_NOTES_ENGLISH_ENDPOINT, QUICK_NOTES_MESSAGES } from "@/constants/quickNotes"
import type { TranscriptionProvider } from "@/constants/voiceInput"
import type { AiSource } from "@/types/ai"
import type { SpokenNoteEnglish } from "@/types/quickNotes"

type SpeechStatus = "idle" | "englishing" | "added" | "failed"

interface SpeechState {
  status: SpeechStatus
  // What the recording was written out as, word for word
  heard: string
  // Who wrote the recording out, and who wrote it in English
  heardBy: TranscriptionProvider[]
  english: string
  language: string
  source: AiSource | null
  // Why it could not be written in English, while `status` is "failed"
  error: string
  // How much of the English the note had no room for
  skipped: number
}

const IDLE: SpeechState = { status: "idle", heard: "", heardBy: [], english: "", language: "", source: null, error: "", skipped: 0 }

/**
 * The last spoken take and what became of it, kept like every tool's work so it survives switching
 * tools. A take still being written in English when the tab reloads has lost its request, so it
 * comes back as one to try again, with what was said kept.
 */
const speechStore = createToolStore("quick-notes:speech", IDLE, {
  version: 1,
  toStored: (state): SpeechState =>
    state.status === "englishing" ? { ...state, status: "failed", error: QUICK_NOTES_MESSAGES.speechEnglishFailed } : state,
})

interface SpeakNoteProps {
  /** Adds text to the end of the note being written and answers how many characters had no room. */
  addToNote: (text: string) => number
  disabled?: boolean
  /** The editor's own label, which the speak button sits beside, on the line above the editor */
  label: React.ReactNode
}

/** The request is module level, so a take finishes into the note even after the page is left. */
async function writeInEnglish(heard: string, heardBy: TranscriptionProvider[], addToNote: (text: string) => number) {
  speechStore.update({ ...IDLE, status: "englishing", heard, heardBy })
  try {
    // Writing it in English saves nothing, so a dropped request is safe to send again
    const { data } = await requestApi<SpokenNoteEnglish & Partial<AiSource>>(
      QUICK_NOTES_ENGLISH_ENDPOINT,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: heard }) },
      { retry: true }
    )
    // A newer take replaced this one while it was being written: the newer one wins
    if (speechStore.getSnapshot().heard !== heard) return
    const skipped = addToNote(data.english)
    speechStore.update({
      status: "added",
      english: data.english,
      language: data.sourceLanguage,
      source: { provider: data.provider ?? null, providers: data.providers ?? [] },
      skipped,
    })
  } catch (error: unknown) {
    if (speechStore.getSnapshot().heard !== heard) return
    speechStore.update({ status: "failed", error: error instanceof Error ? error.message : QUICK_NOTES_MESSAGES.speechEnglishFailed })
  }
}

/**
 * Speak a note instead of typing it: the shared recorder listens for up to six minutes and writes
 * out what was said, which is then written in clear English (POST /api/quick-notes/english) and added
 * to the end of the note in the editor, to be read, changed and saved like anything typed.
 *
 * What was said is kept beside it, so the English can be checked against it; when the English
 * cannot be written, what was said stays here with Try again and a way to add it as it was said,
 * so a recording is never lost.
 */
export const SpeakNote: React.FC<SpeakNoteProps> = ({ addToNote, disabled = false, label }) => {
  const state = useToolStore(speechStore)
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [isShowingHeard, setIsShowingHeard] = useState(false)

  const heardTranscript = useCallback(
    (text: string, providers: TranscriptionProvider[]) => {
      setIsShowingHeard(false)
      void writeInEnglish(text, providers, addToNote)
    },
    [addToNote]
  )

  const addAsSaid = () => {
    const skipped = addToNote(state.heard)
    speechStore.update({ status: "added", english: state.heard, language: "", source: null, skipped })
  }

  const isEnglishing = state.status === "englishing"
  const heardByText = describeProviders(state.heardBy)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {label}
        <VoiceRecorder
          transcribeFor="quick-notes"
          what="your note"
          onTranscript={heardTranscript}
          onError={setVoiceError}
          disabled={disabled || isEnglishing}
          showSource={false}
        />
      </div>

      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {voiceError && (
          <p role="alert" className="flex items-start gap-1.5 text-[12px] text-error">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {voiceError}
          </p>
        )}

        {isEnglishing && (
          <p role="status" className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            {QUICK_NOTES_MESSAGES.speechEnglishing}
          </p>
        )}

        {state.status === "added" && (
          <div className="rounded-xl border border-primary/20 bg-primary-fixed/30 px-3 py-2 text-[12px] text-on-surface">
            <p className="flex flex-wrap items-center gap-x-1.5">
              <Languages size={14} className="shrink-0 text-primary" aria-hidden="true" />
              <span className="font-semibold">{QUICK_NOTES_MESSAGES.speechAdded(state.language)}</span>
              <span className="text-outline">
                {heardByText && `Heard by ${heardByText}`}
                <AiSourceLabel source={state.source} prefix={heardByText ? " · " : ""} />
              </span>
            </p>
            {state.skipped > 0 && <p className="mt-1 text-secondary">{QUICK_NOTES_MESSAGES.speechClipped(state.skipped)}</p>}
            <button
              type="button"
              onClick={() => setIsShowingHeard((open) => !open)}
              aria-expanded={isShowingHeard}
              className="mt-1 inline-flex items-center gap-1 py-1 font-semibold text-primary hover:underline"
            >
              <ChevronDown size={14} className={`transition-transform ${isShowingHeard ? "rotate-180" : ""}`} aria-hidden="true" />
              {isShowingHeard ? "Hide what you said" : "Show what you said"}
            </button>
            {isShowingHeard && <HeardText text={state.heard} />}
          </div>
        )}

        {state.status === "failed" && (
          <div role="alert" className="rounded-xl border border-error/30 bg-error-container/40 px-3 py-2 text-[12px]">
            <p className="flex items-start gap-1.5 text-error">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
              {state.error}
            </p>
            <HeardText text={state.heard} />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void writeInEnglish(state.heard, state.heardBy, addToNote)}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-primary/40 bg-white px-3 py-1.5 font-semibold text-primary hover:bg-primary-fixed/40 disabled:opacity-60"
              >
                <RotateCcw size={13} aria-hidden="true" />
                Try again
              </button>
              <button
                type="button"
                onClick={addAsSaid}
                disabled={disabled}
                className="inline-flex items-center whitespace-nowrap rounded-lg border border-outline-variant bg-white px-3 py-1.5 font-semibold text-on-surface hover:border-primary/40 disabled:opacity-60"
              >
                {QUICK_NOTES_MESSAGES.speechAddAsSaid}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const HeardText: React.FC<{ text: string }> = ({ text }) => (
  <div className="mt-1 flex items-start gap-2 rounded-lg bg-white/80 px-2 py-1.5">
    <p className="max-h-32 flex-1 overflow-y-auto whitespace-pre-wrap [overflow-wrap:anywhere] text-on-surface-variant">
      {text}
    </p>
    <CopyButton text={text} label="Copy what you said" />
  </div>
)
