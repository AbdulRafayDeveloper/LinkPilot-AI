"use client"

import React from "react"
import { CheckCircle2 } from "lucide-react"
import { CONNECTION_NOTE_TONES, type ConnectionNoteToneId } from "@/constants/connectionNote"
import { FIT_CARD_COLUMNS } from "@/components/ui/RadioCardGroup"

interface ToneSelectorProps {
  value: ConnectionNoteToneId
  onChange: (tone: ConnectionNoteToneId) => void
  disabled?: boolean
}

/**
 * Single-choice tone cards built on native radio inputs, so arrow keys and screen
 * readers work without extra code.
 */
export const ToneSelector: React.FC<ToneSelectorProps> = ({ value, onChange, disabled = false }) => (
  <fieldset disabled={disabled} className="min-w-0">
    <legend className="text-[10px] font-bold text-outline uppercase tracking-wider mb-2">Tone</legend>
    {/* As many cards a row as the form has room for, each with its whole name and description */}
    <div className={`grid ${FIT_CARD_COLUMNS} gap-2`}>
      {CONNECTION_NOTE_TONES.map((tone) => {
        const isSelected = value === tone.id
        return (
          <label
            key={tone.id}
            className={`flex items-start gap-2 min-w-0 cursor-pointer rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 ${
              isSelected
                ? "bg-primary-container border-primary-container text-on-primary-container"
                : "bg-surface-container-lowest border-outline-variant text-on-surface hover:bg-surface-container-low"
            }`}
          >
            <input
              type="radio"
              name="connection-note-tone"
              value={tone.id}
              checked={isSelected}
              onChange={() => onChange(tone.id)}
              className="sr-only"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-tight break-words">{tone.label}</span>
              <span
                className={`block text-[11px] leading-snug mt-0.5 break-words ${
                  isSelected ? "text-on-primary-container/80" : "text-outline"
                }`}
              >
                {tone.description}
              </span>
            </span>
            {isSelected && <CheckCircle2 size={16} className="shrink-0 mt-0.5" aria-hidden="true" />}
          </label>
        )
      })}
    </div>
  </fieldset>
)
