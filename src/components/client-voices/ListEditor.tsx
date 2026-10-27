"use client"

import React from "react"
import { Plus, Trash2 } from "lucide-react"
import { TRANSCRIPT_MAX_LENGTH } from "@/constants/clientVoices"

/** One line of either list: the words, and the voices it was asked in, which editing never changes. */
export interface ListEntry {
  text: string
  voices: number[]
}

interface ListEditorProps {
  entries: ListEntry[]
  onChange: (entries: ListEntry[]) => void
  // "task" or "question", for the add button and every label a screen reader reads
  noun: string
  addLabel: string
  emptyLabel: string
}

/**
 * The editor behind both of a batch's lists: every line reworded, taken out, or a new one added.
 *
 * **The voices a line was asked in are not edited**, only carried: they say where the words came
 * from, and a line reworded is still the same request from the same voice. A line added by hand
 * belongs to no voice, which reads as exactly what it is.
 */
export const ListEditor: React.FC<ListEditorProps> = ({ entries, onChange, noun, addLabel, emptyLabel }) => {
  const change = (index: number, text: string) => onChange(entries.map((entry, at) => (at === index ? { ...entry, text } : entry)))
  const remove = (index: number) => onChange(entries.filter((_, at) => at !== index))

  return (
    <div className="flex flex-col gap-2">
      {entries.length === 0 && <p className="text-[12px] text-on-surface-variant">{emptyLabel}</p>}

      {entries.map((entry, index) => (
        <div key={index} className="flex gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest p-2">
          <div className="min-w-0 flex-1">
            <label className="sr-only" htmlFor={`${noun}-${index}`}>
              {noun} {index + 1}
            </label>
            <textarea
              id={`${noun}-${index}`}
              value={entry.text}
              onChange={(event) => change(index, event.target.value)}
              rows={2}
              maxLength={TRANSCRIPT_MAX_LENGTH}
              className="w-full resize-y rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-[13px] leading-relaxed text-on-surface focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
            {entry.voices.length > 0 && (
              <p className="mt-0.5 text-[11px] text-outline">({entry.voices.map((voice) => `Voice ${voice}`).join(", ")})</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => remove(index)}
            aria-label={`Remove ${noun} ${index + 1}`}
            className="h-8 shrink-0 rounded-md px-2 text-outline transition-colors hover:bg-error-container hover:text-error focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...entries, { text: "", voices: [] }])}
        className="inline-flex items-center gap-1 self-start rounded-lg border border-dashed border-outline-variant px-2.5 py-1.5 text-[12px] font-semibold text-on-surface-variant transition-colors hover:border-primary hover:text-primary"
      >
        <Plus size={13} aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  )
}
