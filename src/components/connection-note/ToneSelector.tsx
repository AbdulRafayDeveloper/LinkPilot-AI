"use client"

import React from "react"
import { CheckCircle2 } from "lucide-react"
import { CONNECTION_NOTE_TONES, type ConnectionNoteToneId } from "@/constants/connectionNote"

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
    {/* Up to three cards a row where the form is wide enough: stacked on a tablet, and beside the
        result from xl. At lg the form column is too narrow for three, so it stays at two */}
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
      {CONNECTION_NOTE_TONES.map((tone) => {
        const isSelected = value === tone.id
        return (
          <label
            key={tone.id}
            // Three to a row cuts longer descriptions short, so the whole one is the card's tooltip
            title={tone.description}
            // With an odd number of tones, the last card spans both columns instead of sitting alone
            className={`flex items-start gap-2 min-w-0 cursor-pointer rounded-xl border px-3 py-2 transition-colors focus-within:ring-2 focus-within:ring-primary/40 odd:last:col-span-2 ${
              isSelected
                ? "bg-primary-container border-primary-container text-on-primary-container"
                : "bg-white border-outline-variant text-on-surface hover:bg-surface-container-low"
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
                className={`block text-[11px] leading-tight mt-0.5 truncate ${
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
