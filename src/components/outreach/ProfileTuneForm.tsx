"use client"

import React from "react"
import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react"
import { RadioCardGroup, type RadioCardOption } from "@/components/ui/RadioCardGroup"

interface ProfileTuneFormProps<TuneId extends string> {
  idPrefix: string
  profileData: string
  onProfileChange: (value: string) => void
  profileMaxLength: number
  profileInputRef: React.RefObject<HTMLTextAreaElement | null>
  // The module's own tune list, in display order
  tunes: readonly RadioCardOption<TuneId>[]
  // What the module calls its options, e.g. "Tone"
  tuneLegend?: string
  tune: TuneId | null
  onTuneChange: (tune: TuneId) => void
  formError: string | null
  profileInvalid: boolean
  tuneInvalid: boolean
  isGenerating: boolean
  onSubmit: () => void
  submitLabel: string
  generatingLabel: string
  submitIcon: LucideIcon
}

/**
 * Profile Information input, tune cards and the generate button shared by the outreach
 * tools. The textarea grows to fill the card and scrolls internally.
 */
export function ProfileTuneForm<TuneId extends string>({
  idPrefix,
  profileData,
  onProfileChange,
  profileMaxLength,
  profileInputRef,
  tunes,
  tuneLegend = "Tune",
  tune,
  onTuneChange,
  formError,
  profileInvalid,
  tuneInvalid,
  isGenerating,
  onSubmit,
  submitLabel,
  generatingLabel,
  submitIcon: SubmitIcon,
}: ProfileTuneFormProps<TuneId>) {
  const inputId = `${idPrefix}-profile`
  const errorId = `${idPrefix}-form-error`

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="bg-white border border-outline-variant rounded-2xl shadow-sm p-5 flex flex-col gap-4 min-h-0"
    >
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <label htmlFor={inputId} className="text-[10px] font-bold text-outline uppercase tracking-wider">
            Profile Information
          </label>
          <span className="text-[11px] text-outline">
            {profileData.length.toLocaleString()} / {profileMaxLength.toLocaleString()}
          </span>
        </div>
        <textarea
          ref={profileInputRef}
          id={inputId}
          value={profileData}
          onChange={(event) => onProfileChange(event.target.value)}
          maxLength={profileMaxLength}
          placeholder="Paste the person's LinkedIn profile information here..."
          aria-invalid={profileInvalid}
          aria-describedby={formError ? errorId : undefined}
          className="flex-1 w-full min-h-[200px] lg:min-h-[120px] resize-none rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-[13px] leading-relaxed text-on-surface placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
        />
      </div>

      <RadioCardGroup
        name={`${idPrefix}-tune`}
        legend={tuneLegend}
        options={tunes}
        value={tune}
        onChange={onTuneChange}
        disabled={isGenerating}
        invalid={tuneInvalid}
      />

      {formError && (
        <p id={errorId} role="alert" className="flex items-center gap-1.5 text-xs font-semibold text-error">
          <AlertTriangle size={14} className="shrink-0" aria-hidden="true" />
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={isGenerating}
        aria-busy={isGenerating}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-primary hover:bg-on-primary-fixed-variant text-white rounded-xl text-sm font-semibold shadow-sm active:scale-[0.99] transition-all disabled:opacity-70 disabled:cursor-not-allowed shrink-0"
      >
        {isGenerating ? (
          <Loader2 size={16} className="animate-spin" aria-hidden="true" />
        ) : (
          <SubmitIcon size={16} aria-hidden="true" />
        )}
        {isGenerating ? generatingLabel : submitLabel}
      </button>
    </form>
  )
}
