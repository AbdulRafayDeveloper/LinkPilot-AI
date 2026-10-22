"use client"

import React, { useState } from "react"
import { AlertTriangle, Download, Sparkles, Trash2 } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"
import { CLEAR_POINTS_MAX, CLIENT_VOICES_MESSAGES, TRANSCRIPT_MAX_LENGTH } from "@/constants/clientVoices"
import { durationLabel } from "@/lib/voiceDuration"
import type { SavedVoice } from "@/types/clientVoices"

interface KeptVoiceListProps {
  voices: SavedVoice[]
  // Null while nothing is being deleted; the id of the voice on its way out otherwise
  deletingId: string | null
  onDelete: (voice: SavedVoice) => void
  /**
   * While the batch is being edited: what each transcript and each set of clear points now says,
   * and how to change them. The recording itself is never edited, only the words written from it.
   */
  editing?: {
    transcriptOf: (id: string) => string
    onTranscript: (id: string, text: string) => void
    clearOf: (id: string) => string
    onClear: (id: string, text: string) => void
  }
}

const SIZE_UNIT = 1024

const sizeLabel = (bytes: number) => {
  if (bytes <= 0) return ""
  const kb = bytes / SIZE_UNIT
  return kb >= SIZE_UNIT ? `${(kb / SIZE_UNIT).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`
}

const boxClass =
  "w-full resize-y rounded-lg border border-outline-variant bg-white px-2 py-1.5 text-[13px] leading-relaxed text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"

/**
 * The voices a batch was made from, in the order they arrived: the recording to **play** where it
 * is, how long it runs, what it said in clear words, and the transcript it was written out as.
 *
 * **How long each one runs shows before anything is played.** It is measured in the browser as the
 * voice is added and kept with the record, and `preload="metadata"` means a voice kept before that
 * fills its own length in as the page settles, rather than reading 0:00 until Play is pressed.
 *
 * The player is the browser's own, pointed at a link signed when the page was read, so the bucket
 * stays private and nothing has to be asked for when Play is pressed. A voice whose recording was
 * never stored says so and still shows its words, because they are most of what it was for.
 */
export const KeptVoiceList: React.FC<KeptVoiceListProps> = ({ voices, deletingId, onDelete, editing }) => {
  // What the player itself reports, for a voice kept before its length was measured
  const [measured, setMeasured] = useState<Record<string, number>>({})
  const lengthOf = (voice: SavedVoice) => durationLabel(voice.durationSeconds || measured[voice.id] || 0)

  return (
    <ul className="flex flex-col gap-3">
      {voices.map((voice) => (
        <li key={voice.id} className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-on-surface">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-[11px] font-bold text-primary">
                {voice.position}
              </span>
              Voice {voice.position}
              {lengthOf(voice) && <span className="text-[11px] font-semibold text-on-surface-variant">{lengthOf(voice)}</span>}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              {voice.transcript && !editing && (
                <CopyButton text={voice.transcript} label={`Copy the transcript of voice ${voice.position}`} showLabel />
              )}
              {voice.downloadUrl && (
                <a
                  href={voice.downloadUrl}
                  download={voice.name}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container hover:text-primary"
                >
                  <Download size={13} aria-hidden="true" />
                  Download
                </a>
              )}
              <button
                type="button"
                onClick={() => onDelete(voice)}
                disabled={deletingId === voice.id || Boolean(editing)}
                title={editing ? "Finish editing first" : undefined}
                aria-label={`Delete voice ${voice.position}`}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-outline transition-colors hover:bg-surface-container hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 size={13} aria-hidden="true" />
                Delete
              </button>
            </div>
          </div>

          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-outline">
            <span className="min-w-0 max-w-full truncate">{voice.name}</span>
            {sizeLabel(voice.size) && <span>{sizeLabel(voice.size)}</span>}
          </p>

          {voice.playUrl ? (
            // The browser's own player, which already does play, pause, seek and speed. Its metadata
            // is read as the page settles, so the total time is on screen before anything is pressed
            <audio
              src={voice.playUrl}
              controls
              preload="metadata"
              onLoadedMetadata={(event) => {
                const seconds = event.currentTarget.duration
                if (Number.isFinite(seconds) && seconds > 0) setMeasured((current) => ({ ...current, [voice.id]: seconds }))
              }}
              aria-label={`Voice ${voice.position}, ${voice.name}`}
              className="mt-2 h-10 w-full"
            />
          ) : (
            <p className="mt-2 flex items-center gap-2 rounded-xl bg-surface-container-high px-3 py-2 text-[12px] text-on-surface-variant">
              <AlertTriangle size={14} className="shrink-0 text-secondary" aria-hidden="true" />
              {CLIENT_VOICES_MESSAGES.noRecording}
            </p>
          )}

          {/* What the voice said in clear words comes first, with the word for word under it */}
          <div className="mt-3 rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-outline">
                <Sparkles size={12} className="text-primary" aria-hidden="true" />
                {CLIENT_VOICES_MESSAGES.clearHeading}
              </h4>
              {!editing && voice.clearPoints.length > 0 && (
                <CopyButton
                  text={voice.clearPoints.map((point) => `- ${point}`).join("\n")}
                  label={`Copy what voice ${voice.position} said in clear words`}
                  showLabel
                />
              )}
            </div>

            {editing ? (
              <>
                <label className="sr-only" htmlFor={`clear-${voice.id}`}>
                  What voice {voice.position} said, in clear words
                </label>
                <textarea
                  id={`clear-${voice.id}`}
                  value={editing.clearOf(voice.id)}
                  onChange={(event) => editing.onClear(voice.id, event.target.value)}
                  rows={Math.min(CLEAR_POINTS_MAX, 4)}
                  className={`mt-2 ${boxClass}`}
                />
                <p className="mt-1 text-[11px] text-outline">{CLIENT_VOICES_MESSAGES.clearHint}</p>
              </>
            ) : voice.clearPoints.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1">
                {voice.clearPoints.map((point, index) => (
                  <li key={`${index}-${point.slice(0, 20)}`} className="flex gap-2 text-[13px] leading-relaxed text-on-surface">
                    <span aria-hidden="true" className="text-primary">
                      •
                    </span>
                    <span className="min-w-0 break-words">{point}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[12px] text-outline">{CLIENT_VOICES_MESSAGES.clearEmpty}</p>
            )}
          </div>

          {editing ? (
            <>
              <label className="mt-3 block text-[11px] font-bold uppercase tracking-wide text-outline" htmlFor={`transcript-${voice.id}`}>
                Word for word
              </label>
              <textarea
                id={`transcript-${voice.id}`}
                value={editing.transcriptOf(voice.id)}
                onChange={(event) => editing.onTranscript(voice.id, event.target.value)}
                rows={3}
                maxLength={TRANSCRIPT_MAX_LENGTH}
                className={`mt-1 ${boxClass}`}
              />
            </>
          ) : voice.transcript ? (
            <>
              <p className="mt-3 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-surface-variant">{voice.transcript}</p>
              <p className="mt-1 text-[11px] text-outline">
                <AiSourceLabel source={{ provider: voice.transcribedBy ?? null }} prefix="" />
              </p>
            </>
          ) : (
            <p className="mt-3 text-[12px] text-outline">This voice has no transcript.</p>
          )}
        </li>
      ))}
    </ul>
  )
}
