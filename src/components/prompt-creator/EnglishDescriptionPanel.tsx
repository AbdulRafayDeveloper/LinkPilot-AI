"use client"

import React from "react"
import { Languages, Sparkles } from "lucide-react"
import { CopyButton } from "@/components/ui/CopyButton"
import { PROMPT_CREATOR_MESSAGES } from "@/constants/promptCreator"

interface EnglishDescriptionPanelProps {
  // The description read back in clear English
  english: string
  // The language it was read from ("Roman Urdu"), named by the model
  sourceLanguage: string
  // The description has been changed since this was read, so the two no longer say the same thing
  stale: boolean
  // Write the prompt from this English version instead of what is in the box
  onUse: () => void
  disabled: boolean
}

/**
 * What the user described, in clear English, under the description it was read from.
 *
 * It is here to be read and copied: the prompt is still written from what they typed unless they
 * ask for it to be written from this instead. Nothing is saved by showing it; the English version
 * is kept with the prompt when one is created (see `englishRequest`).
 */
export function EnglishDescriptionPanel({ english, sourceLanguage, stale, onUse, disabled }: EnglishDescriptionPanelProps) {
  return (
    <section className="flex flex-col gap-2 short:gap-1 rounded-xl border border-primary/30 bg-primary-fixed/30 p-3 short:p-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-outline">
          <Languages size={13} className="shrink-0 text-primary" aria-hidden="true" />
          {PROMPT_CREATOR_MESSAGES.englishHeading}
          {sourceLanguage && sourceLanguage.toLowerCase() !== "english" && (
            <span className="font-semibold normal-case tracking-normal text-on-surface-variant">read from {sourceLanguage}</span>
          )}
        </h2>
        <CopyButton text={english} label="Copy what you described, in English" />
      </div>
      {/* A long description would otherwise push the targets and the buttons off the screen, so it
          scrolls inside the panel, and gives back more of that room on a short laptop window */}
      <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[13px] leading-relaxed text-on-surface">{english}</p>
      {stale && (
        <p role="status" className="text-[12px] text-on-surface-variant">
          {PROMPT_CREATOR_MESSAGES.englishStale}
        </p>
      )}
      <button
        type="button"
        onClick={onUse}
        disabled={disabled}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-primary/40 bg-surface-container-lowest px-3 py-2 short:py-1.5 text-[13px] font-semibold text-primary transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Sparkles size={14} aria-hidden="true" />
        {PROMPT_CREATOR_MESSAGES.englishUse}
      </button>
    </section>
  )
}
