"use client"

import React from "react"
import { AlertTriangle, Download, Trash2 } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { AiSourceLabel } from "@/components/ui/AiSourceLabel"
import { CLIENT_VOICES_MESSAGES, TRANSCRIPT_MAX_LENGTH } from "@/constants/clientVoices"
import type { SavedVoice } from "@/types/clientVoices"

interface KeptVoiceListProps {
  voices: SavedVoice[]
  // Null while nothing is being deleted; the id of the voice on its way out otherwise
  deletingId: string | null
  onDelete: (voice: SavedVoice) => void
  /**
   * While the batch is being edited: what each transcript now says, and how to change it. The
   * recording itself is never edited, only the words the app wrote down from it.
   */
  editing?: { transcriptOf: (id: string) => string; onTranscript: (id: string, text: string) => void }
}

const SIZE_UNIT = 1024

const sizeLabel = (bytes: number) => {
  if (bytes <= 0) return ""
  const kb = bytes / SIZE_UNIT
  return kb >= SIZE_UNIT ? `${(kb / SIZE_UNIT).toFixed(1)} MB` : `${Math.max(1, Math.round(kb))} KB`
}

/**
 * The voices a batch was made from, in the order they arrived: the recording to **play** where it
 * is, the transcript it was written out as, and the file to keep.
 *
 * The player is the browser's own, pointed at a link signed when the page was read, so the bucket
 * stays private and nothing has to be asked for when Play is pressed. A voice whose recording was
 * never stored (a batch run before the app had file storage) says so and still shows its transcript,
 * because the transcript is most of what the recording was for.
 */
export const KeptVoiceList: React.FC<KeptVoiceListProps> = ({ voices, deletingId, onDelete, editing }) => (
  <ul className="flex flex-col gap-3">
    {voices.map((voice) => (
      <li key={voice.id} className="rounded-2xl border border-outline-variant bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex min-w-0 items-center gap-2 text-sm font-bold text-on-surface">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-[11px] font-bold text-primary">
              {voice.position}
            </span>
            Voice {voice.position}
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            {voice.transcript && !editing && <CopyButton text={voice.transcript} label={`Copy the transcript of voice ${voice.position}`} showLabel />}
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
          // The browser's own player: it already does play, pause, seek and speed
          <audio
            src={voice.playUrl}
            controls
            preload="none"
            aria-label={`Voice ${voice.position}, ${voice.name}`}
            className="mt-2 h-10 w-full"
          />
        ) : (
          <p className="mt-2 flex items-center gap-2 rounded-xl bg-surface-container-high px-3 py-2 text-[12px] text-on-surface-variant">
            <AlertTriangle size={14} className="shrink-0 text-secondary" aria-hidden="true" />
            {CLIENT_VOICES_MESSAGES.noRecording}
          </p>
        )}

        {editing ? (
          <>
            <label className="sr-only" htmlFor={`transcript-${voice.id}`}>
              What voice {voice.position} said
            </label>
            <textarea
              id={`transcript-${voice.id}`}
              value={editing.transcriptOf(voice.id)}
              onChange={(event) => editing.onTranscript(voice.id, event.target.value)}
              rows={3}
              maxLength={TRANSCRIPT_MAX_LENGTH}
              className="mt-2 w-full resize-y rounded-lg border border-outline-variant bg-white px-2 py-1.5 text-[13px] leading-relaxed text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </>
        ) : voice.transcript ? (
          <>
            <p className="mt-2 whitespace-pre-wrap break-words text-[13px] leading-relaxed text-on-surface">{voice.transcript}</p>
            <p className="mt-1 text-[11px] text-outline">
              <AiSourceLabel source={{ provider: voice.transcribedBy ?? null }} prefix="" />
            </p>
          </>
        ) : (
          <p className="mt-2 text-[12px] text-outline">This voice has no transcript.</p>
        )}
      </li>
    ))}
  </ul>
)
