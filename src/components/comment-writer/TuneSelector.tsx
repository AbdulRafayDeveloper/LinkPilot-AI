"use client"

import React from "react"
import { RadioCardGroup } from "@/components/ui/RadioCardGroup"
import { COMMENT_TUNES, type CommentTuneId } from "@/constants/commentWriter"

const TUNE_OPTIONS = COMMENT_TUNES.map((tune) => ({ id: tune.id, label: tune.shortLabel, description: tune.description }))

interface TuneSelectorProps {
  value: CommentTuneId | null
  onChange: (tune: CommentTuneId) => void
  disabled?: boolean
  invalid?: boolean
}

/**
 * The six comment styles: three per row on wider screens, stacked on phones.
 */
export const TuneSelector: React.FC<TuneSelectorProps> = ({ value, onChange, disabled = false, invalid = false }) => (
  <RadioCardGroup
    name="comment-writer-tune"
    legend="Comment style"
    options={TUNE_OPTIONS}
    value={value}
    onChange={onChange}
    disabled={disabled}
    invalid={invalid}
    columnsClassName="grid-cols-1 sm:grid-cols-3"
  />
)
